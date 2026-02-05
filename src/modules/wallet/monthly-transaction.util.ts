import mongoose, { Schema, Model, Types, ClientSession } from 'mongoose';
import {
  ITransaction,
  ITransactionDocument,
  ITransactionModel,
  TRANSACTION_TYPES,
  CREDIT_SOURCES,
  TRANSACTION_STATUSES,
  WalletTransactionType,
  CreditSource,
  TransactionStatus,
} from './transaction.model.js';
import { logger } from '../../config/logger.js';

// Cache for monthly transaction models
const modelCache: Map<string, ITransactionModel> = new Map();

/**
 * Get the collection name for a given date
 * Format: transactions_YYYY_MM
 */
export function getMonthlyCollectionName(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `transactions_${year}_${month}`;
}

/**
 * Parse year and month from collection name
 */
export function parseCollectionName(collectionName: string): { year: number; month: number } | null {
  const match = collectionName.match(/^transactions_(\d{4})_(\d{2})$/);
  if (!match) return null;
  return {
    year: parseInt(match[1], 10),
    month: parseInt(match[2], 10),
  };
}

/**
 * Get all monthly collection names between two dates
 */
export function getCollectionNamesInRange(startDate: Date, endDate: Date): string[] {
  const collections: string[] = [];
  const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

  while (current <= end) {
    collections.push(getMonthlyCollectionName(current));
    current.setMonth(current.getMonth() + 1);
  }

  return collections;
}

/**
 * Create the transaction schema (shared across all monthly collections)
 */
function createTransactionSchema(): Schema<ITransactionDocument, ITransactionModel> {
  const TransactionSchema = new Schema<ITransactionDocument, ITransactionModel>(
    {
      user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User is required'],
        index: true,
      },
      type: {
        type: String,
        enum: {
          values: TRANSACTION_TYPES,
          message: '{VALUE} is not a valid transaction type',
        },
        required: [true, 'Transaction type is required'],
      },
      amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: [0.01, 'Amount must be greater than 0'],
      },
      balanceBefore: {
        type: Number,
        required: [true, 'Balance before is required'],
        min: [0, 'Balance before cannot be negative'],
      },
      balanceAfter: {
        type: Number,
        required: [true, 'Balance after is required'],
        min: [0, 'Balance after cannot be negative'],
      },
      source: {
        type: String,
        enum: {
          values: CREDIT_SOURCES,
          message: '{VALUE} is not a valid credit source',
        },
      },
      description: {
        type: String,
        required: [true, 'Description is required'],
        trim: true,
        maxlength: [500, 'Description cannot exceed 500 characters'],
      },
      status: {
        type: String,
        enum: {
          values: TRANSACTION_STATUSES,
          message: '{VALUE} is not a valid status',
        },
        default: 'completed',
      },
      order: {
        type: Schema.Types.ObjectId,
        ref: 'Order',
        sparse: true,
      },
      processedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        sparse: true,
      },
      metadata: {
        type: Schema.Types.Mixed,
      },
    },
    {
      timestamps: true,
      toJSON: {
        virtuals: true,
        transform: (_doc: ITransactionDocument, ret: Record<string, unknown>) => {
          delete ret['__v'];
          return ret;
        },
      },
    }
  );

  // Indexes for efficient queries
  TransactionSchema.index({ user: 1, createdAt: -1 });
  TransactionSchema.index({ type: 1, createdAt: -1 });
  TransactionSchema.index({ status: 1 });
  TransactionSchema.index({ createdAt: -1 });

  // Static methods
  TransactionSchema.statics.findByUser = function (
    userId: Types.ObjectId,
    options: { limit?: number; skip?: number } = {}
  ): Promise<ITransactionDocument[]> {
    const { limit = 50, skip = 0 } = options;
    return this.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('processedBy', 'name email')
      .populate('order', 'orderNumber');
  };

  TransactionSchema.statics.findByOrder = function (orderId: Types.ObjectId): Promise<ITransactionDocument[]> {
    return this.find({ order: orderId }).sort({ createdAt: -1 });
  };

  TransactionSchema.statics.getUserBalance = async function (userId: Types.ObjectId): Promise<number> {
    const result = await this.aggregate([
      { $match: { user: userId, status: 'completed' } },
      {
        $group: {
          _id: null,
          totalCredits: {
            $sum: {
              $cond: [{ $in: ['$type', ['credit', 'refund']] }, '$amount', 0],
            },
          },
          totalDebits: {
            $sum: {
              $cond: [{ $eq: ['$type', 'debit'] }, '$amount', 0],
            },
          },
        },
      },
    ]);

    if (result.length === 0) {
      return 0;
    }

    return result[0].totalCredits - result[0].totalDebits;
  };

  return TransactionSchema;
}

/**
 * Get or create a transaction model for a specific month
 */
export function getMonthlyTransactionModel(date: Date = new Date()): ITransactionModel {
  const collectionName = getMonthlyCollectionName(date);

  // Check cache first
  if (modelCache.has(collectionName)) {
    return modelCache.get(collectionName)!;
  }

  // Check if model already exists in mongoose
  if (mongoose.models[collectionName]) {
    const model = mongoose.models[collectionName] as ITransactionModel;
    modelCache.set(collectionName, model);
    return model;
  }

  // Create new model for this month's collection
  const schema = createTransactionSchema();
  const model = mongoose.model<ITransactionDocument, ITransactionModel>(collectionName, schema, collectionName);

  modelCache.set(collectionName, model);
  logger.info(`Created transaction collection for ${collectionName}`);

  return model;
}

/**
 * Get the current month's transaction model (convenience function)
 */
export function getCurrentTransactionModel(): ITransactionModel {
  return getMonthlyTransactionModel(new Date());
}

/**
 * Transaction data for creating a new transaction
 */
export interface CreateTransactionData {
  user: Types.ObjectId;
  type: WalletTransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  source?: CreditSource;
  status?: TransactionStatus;
  order?: Types.ObjectId;
  processedBy?: Types.ObjectId;
  metadata?: Record<string, unknown>;
}

/**
 * Create a transaction in the appropriate monthly collection
 */
export async function createTransaction(
  data: CreateTransactionData,
  session?: ClientSession
): Promise<ITransactionDocument> {
  const Model = getCurrentTransactionModel();
  const [transaction] = await Model.create([data], { session });
  return transaction;
}

/**
 * Query transactions across multiple months
 */
export interface TransactionQueryOptions {
  user?: Types.ObjectId;
  type?: WalletTransactionType;
  source?: CreditSource;
  status?: TransactionStatus;
  order?: Types.ObjectId;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
  populate?: string[];
}

/**
 * Query transactions across all relevant monthly collections
 */
export async function queryTransactions(options: TransactionQueryOptions): Promise<{
  transactions: ITransactionDocument[];
  total: number;
}> {
  const {
    user,
    type,
    source,
    status,
    order,
    startDate,
    endDate,
    limit = 50,
    skip = 0,
    sort = { createdAt: -1 },
    populate = [],
  } = options;

  // Determine which collections to query
  const queryStartDate = startDate || new Date(2024, 0, 1); // Default to Jan 2024
  const queryEndDate = endDate || new Date();
  const collectionNames = getCollectionNamesInRange(queryStartDate, queryEndDate);

  // Build the match query
  const matchQuery: Record<string, unknown> = {};
  if (user) matchQuery['user'] = user;
  if (type) matchQuery['type'] = type;
  if (source) matchQuery['source'] = source;
  if (status) matchQuery['status'] = status;
  if (order) matchQuery['order'] = order;
  if (startDate || endDate) {
    matchQuery['createdAt'] = {};
    if (startDate) (matchQuery['createdAt'] as Record<string, Date>)['$gte'] = startDate;
    if (endDate) (matchQuery['createdAt'] as Record<string, Date>)['$lte'] = endDate;
  }

  // Query each collection and combine results
  const allTransactions: ITransactionDocument[] = [];
  let totalCount = 0;

  // Query in reverse chronological order (newest months first)
  for (const collectionName of collectionNames.reverse()) {
    try {
      const Model = getMonthlyTransactionModel(
        new Date(parseInt(collectionName.split('_')[1]), parseInt(collectionName.split('_')[2]) - 1, 1)
      );

      // Get count for this collection
      const count = await Model.countDocuments(matchQuery);
      totalCount += count;

      // If we've already collected enough for skip + limit, skip this collection
      if (allTransactions.length >= skip + limit) continue;

      // Query with adjusted skip/limit
      const currentSkip = Math.max(0, skip - allTransactions.length);
      const currentLimit = limit - Math.max(0, allTransactions.length - skip);

      if (currentLimit <= 0) continue;

      let query = Model.find(matchQuery).sort(sort).skip(currentSkip).limit(currentLimit);

      // Apply population
      for (const field of populate) {
        if (field === 'processedBy') {
          query = query.populate('processedBy', 'name email');
        } else if (field === 'order') {
          query = query.populate('order', 'orderNumber');
        } else if (field === 'user') {
          query = query.populate('user', 'name email rollNumber');
        }
      }

      const transactions = await query;
      allTransactions.push(...transactions);
    } catch (error) {
      // Collection might not exist yet, skip it
      logger.debug(`Collection ${collectionName} not found or empty`);
    }
  }

  // Sort combined results and apply final pagination
  allTransactions.sort((a, b) => {
    const sortField = Object.keys(sort)[0];
    const sortOrder = sort[sortField];
    const aVal = a[sortField as keyof ITransactionDocument];
    const bVal = b[sortField as keyof ITransactionDocument];
    if (aVal < bVal) return sortOrder === 1 ? -1 : 1;
    if (aVal > bVal) return sortOrder === 1 ? 1 : -1;
    return 0;
  });

  return {
    transactions: allTransactions.slice(0, limit),
    total: totalCount,
  };
}

/**
 * Get user's transaction history across all months
 */
export async function getUserTransactions(
  userId: Types.ObjectId,
  options: {
    type?: WalletTransactionType;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    skip?: number;
  } = {}
): Promise<{ transactions: ITransactionDocument[]; total: number }> {
  return queryTransactions({
    user: userId,
    type: options.type,
    startDate: options.startDate,
    endDate: options.endDate,
    limit: options.limit,
    skip: options.skip,
    populate: ['processedBy', 'order'],
  });
}

/**
 * Get transactions for an order (usually in one month but might span months)
 */
export async function getOrderTransactions(orderId: Types.ObjectId): Promise<ITransactionDocument[]> {
  const result = await queryTransactions({
    order: orderId,
    limit: 100,
  });
  return result.transactions;
}

/**
 * Calculate user balance from all monthly collections
 */
export async function calculateUserBalanceFromTransactions(userId: Types.ObjectId): Promise<number> {
  const collectionNames = getCollectionNamesInRange(new Date(2024, 0, 1), new Date());
  let totalCredits = 0;
  let totalDebits = 0;

  for (const collectionName of collectionNames) {
    try {
      const Model = getMonthlyTransactionModel(
        new Date(parseInt(collectionName.split('_')[1]), parseInt(collectionName.split('_')[2]) - 1, 1)
      );

      const result = await Model.aggregate([
        { $match: { user: userId, status: 'completed' } },
        {
          $group: {
            _id: null,
            credits: {
              $sum: {
                $cond: [{ $in: ['$type', ['credit', 'refund']] }, '$amount', 0],
              },
            },
            debits: {
              $sum: {
                $cond: [{ $eq: ['$type', 'debit'] }, '$amount', 0],
              },
            },
          },
        },
      ]);

      if (result.length > 0) {
        totalCredits += result[0].credits;
        totalDebits += result[0].debits;
      }
    } catch (error) {
      // Collection doesn't exist, skip
    }
  }

  return totalCredits - totalDebits;
}

/**
 * Get list of all existing transaction collections
 */
export async function getExistingTransactionCollections(): Promise<string[]> {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection not established');
  }
  const collections = await db.listCollections().toArray();
  return collections
    .map((c) => c.name)
    .filter((name) => name.startsWith('transactions_'))
    .sort()
    .reverse();
}

/**
 * Migrate existing transactions from the old 'transactions' collection to monthly collections
 * This should be run once during deployment
 */
export async function migrateExistingTransactions(): Promise<{ migrated: number; errors: number }> {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection not established');
  }
  const oldCollectionExists = await db.listCollections({ name: 'transactions' }).hasNext();

  if (!oldCollectionExists) {
    logger.info('No old transactions collection found, skipping migration');
    return { migrated: 0, errors: 0 };
  }

  const oldCollection = db.collection('transactions');
  const cursor = oldCollection.find({});

  let migrated = 0;
  let errors = 0;

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    if (!doc) continue;

    try {
      const createdAt = doc.createdAt || new Date();
      const Model = getMonthlyTransactionModel(createdAt);

      // Check if already migrated
      const existing = await Model.findById(doc._id);
      if (existing) {
        continue;
      }

      // Insert into monthly collection
      await Model.create({
        _id: doc._id,
        user: doc.user,
        type: doc.type,
        amount: doc.amount,
        balanceBefore: doc.balanceBefore,
        balanceAfter: doc.balanceAfter,
        source: doc.source,
        description: doc.description,
        status: doc.status || 'completed',
        order: doc.order,
        processedBy: doc.processedBy,
        metadata: doc.metadata,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      });

      migrated++;
    } catch (error) {
      logger.error('Error migrating transaction', { id: doc._id, error });
      errors++;
    }
  }

  logger.info(`Transaction migration complete: ${migrated} migrated, ${errors} errors`);
  return { migrated, errors };
}

export default {
  getMonthlyCollectionName,
  getMonthlyTransactionModel,
  getCurrentTransactionModel,
  createTransaction,
  queryTransactions,
  getUserTransactions,
  getOrderTransactions,
  calculateUserBalanceFromTransactions,
  getExistingTransactionCollections,
  migrateExistingTransactions,
};
