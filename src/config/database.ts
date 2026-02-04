import mongoose from 'mongoose';
import { logger } from './logger.js';

const DEFAULT_MONGODB_URI =
  'mongodb+srv://doadmin:hv4j5lOpX2813W67@mecfoodapp-db-13d8f7f1.mongo.ondigitalocean.com/admin?tls=true&authSource=admin&replicaSet=mecfoodapp-db';

interface DatabaseConfig {
  uri: string;
  options: mongoose.ConnectOptions;
}

const getDatabaseConfig = (): DatabaseConfig => {
  const uri = process.env['MONGODB_URI'] ?? DEFAULT_MONGODB_URI;

  const options: mongoose.ConnectOptions = {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4,
    retryWrites: true,
    w: 'majority',
  };

  return { uri, options };
};

export const connectDatabase = async (): Promise<typeof mongoose> => {
  const { uri, options } = getDatabaseConfig();

  // Set up connection event handlers
  mongoose.connection.on('connected', () => {
    logger.info('MongoDB connected successfully');
  });

  mongoose.connection.on('error', (error: Error) => {
    logger.error('MongoDB connection error:', { error: error.message });
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });

  // Handle process termination
  process.on('SIGINT', async () => {
    try {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed due to app termination');
      process.exit(0);
    } catch (error) {
      logger.error('Error closing MongoDB connection:', { error });
      process.exit(1);
    }
  });

  try {
    logger.info('Connecting to MongoDB...');
    const connection = await mongoose.connect(uri, options);
    logger.info(`MongoDB connected to database: ${connection.connection.name}`);
    return connection;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to connect to MongoDB:', { error: errorMessage });
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error disconnecting from MongoDB:', { error: errorMessage });
    throw error;
  }
};

export const getDatabaseStatus = (): {
  isConnected: boolean;
  readyState: number;
  readyStateText: string;
} => {
  const readyState = mongoose.connection.readyState;
  const readyStateMap: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  return {
    isConnected: readyState === 1,
    readyState,
    readyStateText: readyStateMap[readyState] ?? 'unknown',
  };
};

export default { connectDatabase, disconnectDatabase, getDatabaseStatus };
