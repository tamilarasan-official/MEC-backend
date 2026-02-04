/**
 * Seed script to create test users
 * Run with: npx tsx scripts/seed-users.ts
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env['MONGODB_URI'] || '';

async function seedUsers() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }

    const usersCollection = db.collection('users');
    const shopsCollection = db.collection('shops');

    // 1. Approve existing test user
    const approveResult = await usersCollection.updateOne(
      { username: 'testuser' },
      { $set: { isApproved: true } }
    );
    console.log(`Approved testuser: ${approveResult.modifiedCount > 0 ? 'Yes' : 'Already approved or not found'}`);

    // 2. Create a test shop first (needed for captain and owner)
    let shopId: mongoose.Types.ObjectId;
    const existingShop = await shopsCollection.findOne({ name: 'MEC Canteen' });

    if (!existingShop) {
      const shopResult = await shopsCollection.insertOne({
        name: 'MEC Canteen',
        description: 'Main campus canteen serving delicious food',
        image: '',
        isActive: true,
        openingTime: '08:00',
        closingTime: '20:00',
        rating: 4.5,
        totalOrders: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      shopId = shopResult.insertedId;
      console.log('Created test shop: MEC Canteen');
    } else {
      shopId = existingShop._id as mongoose.Types.ObjectId;
      console.log('Shop already exists: MEC Canteen');
    }

    // 3. Create superadmin if not exists
    const existingSuperadmin = await usersCollection.findOne({ username: 'superadmin' });

    if (!existingSuperadmin) {
      const passwordHash = await bcrypt.hash('Admin@123', 12);

      await usersCollection.insertOne({
        username: 'superadmin',
        passwordHash,
        name: 'Super Admin',
        email: 'admin@madrasone.com',
        role: 'superadmin',
        isApproved: true,
        isActive: true,
        balance: 0,
        fcmTokens: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log('Created superadmin user');
    } else {
      console.log('Superadmin already exists');
    }

    // 4. Create a test student with balance
    const existingStudent = await usersCollection.findOne({ username: 'student1' });

    if (!existingStudent) {
      const passwordHash = await bcrypt.hash('Student@123', 12);

      await usersCollection.insertOne({
        username: 'student1',
        passwordHash,
        name: 'John Student',
        email: 'student1@college.edu',
        phone: '9876543210',
        role: 'student',
        isApproved: true,
        isActive: true,
        rollNumber: '22CS001',
        department: 'CSE',
        year: 2,
        balance: 500,
        fcmTokens: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log('Created student1 user with Rs.500 balance');
    } else {
      console.log('Student1 already exists');
    }

    // 5. Create accountant user
    const existingAccountant = await usersCollection.findOne({ username: 'accountant1' });

    if (!existingAccountant) {
      const passwordHash = await bcrypt.hash('Account@123', 12);

      await usersCollection.insertOne({
        username: 'accountant1',
        passwordHash,
        name: 'Ravi Accountant',
        email: 'accountant@madrasone.com',
        phone: '9876543211',
        role: 'accountant',
        isApproved: true,
        isActive: true,
        balance: 0,
        fcmTokens: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log('Created accountant1 user');
    } else {
      console.log('Accountant1 already exists');
    }

    // 6. Create captain user (assigned to shop)
    const existingCaptain = await usersCollection.findOne({ username: 'captain1' });

    if (!existingCaptain) {
      const passwordHash = await bcrypt.hash('Captain@123', 12);

      await usersCollection.insertOne({
        username: 'captain1',
        passwordHash,
        name: 'Kumar Captain',
        email: 'captain@madrasone.com',
        phone: '9876543212',
        role: 'captain',
        isApproved: true,
        isActive: true,
        balance: 0,
        shop: shopId,
        fcmTokens: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log('Created captain1 user (assigned to MEC Canteen)');
    } else {
      // Update captain to have shop assignment if missing
      if (!existingCaptain.shop) {
        await usersCollection.updateOne(
          { username: 'captain1' },
          { $set: { shop: shopId } }
        );
        console.log('Updated captain1 with shop assignment');
      } else {
        console.log('Captain1 already exists');
      }
    }

    // 7. Create owner user (assigned to shop)
    const existingOwner = await usersCollection.findOne({ username: 'owner1' });

    if (!existingOwner) {
      const passwordHash = await bcrypt.hash('Owner@123', 12);

      await usersCollection.insertOne({
        username: 'owner1',
        passwordHash,
        name: 'Prasad Owner',
        email: 'owner@madrasone.com',
        phone: '9876543213',
        role: 'owner',
        isApproved: true,
        isActive: true,
        balance: 0,
        shop: shopId,
        fcmTokens: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log('Created owner1 user (assigned to MEC Canteen)');
    } else {
      // Update owner to have shop assignment if missing
      if (!existingOwner.shop) {
        await usersCollection.updateOne(
          { username: 'owner1' },
          { $set: { shop: shopId } }
        );
        console.log('Updated owner1 with shop assignment');
      } else {
        console.log('Owner1 already exists');
      }
    }

    console.log('\n========================================');
    console.log('         TEST CREDENTIALS');
    console.log('========================================');
    console.log('\n1. Student:');
    console.log('   Username: student1');
    console.log('   Password: Student@123');
    console.log('   Balance: Rs.500');
    console.log('\n2. Superadmin:');
    console.log('   Username: superadmin');
    console.log('   Password: Admin@123');
    console.log('\n3. Accountant:');
    console.log('   Username: accountant1');
    console.log('   Password: Account@123');
    console.log('\n4. Captain (Shop Staff):');
    console.log('   Username: captain1');
    console.log('   Password: Captain@123');
    console.log('   Shop: MEC Canteen');
    console.log('\n5. Owner (Shop Owner):');
    console.log('   Username: owner1');
    console.log('   Password: Owner@123');
    console.log('   Shop: MEC Canteen');
    console.log('\n========================================\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

seedUsers();
