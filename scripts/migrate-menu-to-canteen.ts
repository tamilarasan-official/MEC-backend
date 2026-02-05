/**
 * Migration Script: Move all existing menu items to MEC CANTEEN shop
 *
 * This script will:
 * 1. Find or create the "MEC CANTEEN" shop
 * 2. Create default categories for the canteen
 * 3. Update all existing food items to belong to MEC CANTEEN
 *
 * Run with: npx ts-node scripts/migrate-menu-to-canteen.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env['MONGODB_URI'];

if (!MONGODB_URI) {
  console.error('Error: MONGODB_URI environment variable is required');
  process.exit(1);
}

// Default categories for the canteen
const DEFAULT_CATEGORIES = [
  { name: 'Breakfast', description: 'Morning breakfast items', sortOrder: 1 },
  { name: 'Lunch', description: 'Lunch specials and meals', sortOrder: 2 },
  { name: 'Snacks', description: 'Quick bites and snacks', sortOrder: 3 },
  { name: 'Beverages', description: 'Hot and cold drinks', sortOrder: 4 },
  { name: 'Desserts', description: 'Sweet treats', sortOrder: 5 },
  { name: 'South Indian', description: 'South Indian specialties', sortOrder: 6 },
  { name: 'North Indian', description: 'North Indian dishes', sortOrder: 7 },
  { name: 'Fast Food', description: 'Quick fast food items', sortOrder: 8 },
];

async function migrate() {
  console.log('🚀 Starting migration...\n');

  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }

    const shopsCollection = db.collection('shops');
    const categoriesCollection = db.collection('categories');
    const foodItemsCollection = db.collection('fooditems');

    // Step 1: Find or create MEC CANTEEN shop
    console.log('🏪 Step 1: Finding or creating MEC CANTEEN shop...');

    let shop = await shopsCollection.findOne({
      name: { $regex: /^MEC\s*CANTEEN$/i }
    });

    if (!shop) {
      // Create the shop
      const shopResult = await shopsCollection.insertOne({
        name: 'MEC CANTEEN',
        description: 'Main campus canteen serving delicious and affordable food for students and staff',
        category: 'canteen',
        isActive: true,
        rating: 4.5,
        totalRatings: 0,
        totalOrders: 0,
        operatingHours: [
          { day: 'monday', openTime: '07:30', closeTime: '21:00', isClosed: false },
          { day: 'tuesday', openTime: '07:30', closeTime: '21:00', isClosed: false },
          { day: 'wednesday', openTime: '07:30', closeTime: '21:00', isClosed: false },
          { day: 'thursday', openTime: '07:30', closeTime: '21:00', isClosed: false },
          { day: 'friday', openTime: '07:30', closeTime: '21:00', isClosed: false },
          { day: 'saturday', openTime: '08:00', closeTime: '20:00', isClosed: false },
          { day: 'sunday', openTime: '08:00', closeTime: '18:00', isClosed: false },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      shop = await shopsCollection.findOne({ _id: shopResult.insertedId });
      console.log('✅ Created MEC CANTEEN shop with ID:', shop?._id.toString());
    } else {
      console.log('✅ Found existing MEC CANTEEN shop with ID:', shop._id.toString());
    }

    const shopId = shop!._id;

    // Step 2: Create categories for MEC CANTEEN
    console.log('\n📁 Step 2: Creating categories for MEC CANTEEN...');

    const categoryMap = new Map<string, mongoose.Types.ObjectId>();

    for (const cat of DEFAULT_CATEGORIES) {
      // Check if category exists
      let existingCategory = await categoriesCollection.findOne({
        shop: shopId,
        name: { $regex: new RegExp(`^${cat.name}$`, 'i') }
      });

      if (!existingCategory) {
        const result = await categoriesCollection.insertOne({
          shop: shopId,
          name: cat.name,
          description: cat.description,
          sortOrder: cat.sortOrder,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        existingCategory = await categoriesCollection.findOne({ _id: result.insertedId });
        console.log(`  ✅ Created category: ${cat.name}`);
      } else {
        console.log(`  ℹ️  Category already exists: ${cat.name}`);
      }

      categoryMap.set(cat.name.toLowerCase(), existingCategory!._id);
    }

    // Step 3: Get all existing food items
    console.log('\n🍔 Step 3: Migrating existing food items...');

    const existingItems = await foodItemsCollection.find({}).toArray();
    console.log(`  Found ${existingItems.length} existing food items`);

    if (existingItems.length === 0) {
      console.log('  ℹ️  No food items to migrate');
    } else {
      // Get a default category for items without a valid category
      const defaultCategory = categoryMap.get('snacks') || categoryMap.values().next().value;

      let migratedCount = 0;
      let alreadyMigratedCount = 0;

      for (const item of existingItems) {
        // Check if already belongs to MEC CANTEEN
        if (item.shop && item.shop.toString() === shopId.toString()) {
          alreadyMigratedCount++;
          continue;
        }

        // Determine the category based on item's existing category name or default
        let categoryId = defaultCategory;

        if (item.category) {
          // Try to find matching category
          const existingCat = await categoriesCollection.findOne({ _id: item.category });
          if (existingCat) {
            const matchingCategory = categoryMap.get(existingCat.name.toLowerCase());
            if (matchingCategory) {
              categoryId = matchingCategory;
            }
          }
        }

        // Update the food item
        await foodItemsCollection.updateOne(
          { _id: item._id },
          {
            $set: {
              shop: shopId,
              category: categoryId,
              updatedAt: new Date(),
            }
          }
        );
        migratedCount++;
      }

      console.log(`  ✅ Migrated ${migratedCount} food items to MEC CANTEEN`);
      console.log(`  ℹ️  ${alreadyMigratedCount} items were already in MEC CANTEEN`);
    }

    // Step 4: Update any orphaned categories to belong to MEC CANTEEN
    console.log('\n📂 Step 4: Checking for orphaned categories...');

    const orphanedCategories = await categoriesCollection.find({
      $or: [
        { shop: { $exists: false } },
        { shop: null }
      ]
    }).toArray();

    if (orphanedCategories.length > 0) {
      await categoriesCollection.updateMany(
        {
          $or: [
            { shop: { $exists: false } },
            { shop: null }
          ]
        },
        {
          $set: {
            shop: shopId,
            updatedAt: new Date(),
          }
        }
      );
      console.log(`  ✅ Updated ${orphanedCategories.length} orphaned categories`);
    } else {
      console.log('  ℹ️  No orphaned categories found');
    }

    // Step 5: Summary
    console.log('\n📊 Migration Summary:');
    console.log('─'.repeat(40));

    const finalShop = await shopsCollection.findOne({ _id: shopId });
    const finalCategories = await categoriesCollection.countDocuments({ shop: shopId });
    const finalItems = await foodItemsCollection.countDocuments({ shop: shopId });

    console.log(`  Shop: ${finalShop?.name}`);
    console.log(`  Shop ID: ${shopId.toString()}`);
    console.log(`  Categories: ${finalCategories}`);
    console.log(`  Menu Items: ${finalItems}`);
    console.log('─'.repeat(40));

    console.log('\n✅ Migration completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

// Run the migration
migrate();
