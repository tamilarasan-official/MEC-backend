import 'dotenv/config';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { logger } from './config/logger.js';
import { SocketEvents } from './config/constants.js';

// Server configuration
const PORT = parseInt(process.env['PORT'] ?? '3000', 10);
const HOST = process.env['HOST'] ?? '0.0.0.0';

// Create HTTP server
const server = http.createServer(app);

// Socket.IO configuration
const isProduction = process.env['NODE_ENV'] === 'production';

// Dynamic origin validation for Socket.IO
const socketCorsOrigin = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
  // Allow requests with no origin
  if (!origin) {
    return callback(null, true);
  }

  // In development, allow localhost
  if (!isProduction) {
    const devOrigins = ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:3001', 'http://localhost:3002'];
    if (devOrigins.includes(origin)) {
      return callback(null, true);
    }
  }

  // In production, allow all *.welocalhost.com subdomains
  if (origin.endsWith('.welocalhost.com') || origin === 'https://welocalhost.com') {
    return callback(null, true);
  }

  // Check explicit SOCKET_CORS_ORIGIN env var
  const allowedOrigins = process.env['SOCKET_CORS_ORIGIN']?.split(',') || [];
  if (allowedOrigins.includes(origin)) {
    return callback(null, true);
  }

  logger.warn(`Socket.IO CORS blocked origin: ${origin}`);
  callback(new Error('Not allowed by CORS'));
};

const io = new SocketIOServer(server, {
  cors: {
    origin: socketCorsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Socket.IO connection handling
io.on(SocketEvents.CONNECT, (socket) => {
  logger.info('Client connected', { socketId: socket.id });

  // Handle authentication (to be implemented with JWT)
  socket.on('authenticate', (token: string) => {
    // TODO: Verify JWT token and join user-specific rooms
    logger.debug('Authentication attempt', { socketId: socket.id, hasToken: !!token });
  });

  // Join room for order updates
  socket.on('join:order', (orderId: string) => {
    socket.join(`order:${orderId}`);
    logger.debug('Joined order room', { socketId: socket.id, orderId });
  });

  // Leave order room
  socket.on('leave:order', (orderId: string) => {
    socket.leave(`order:${orderId}`);
    logger.debug('Left order room', { socketId: socket.id, orderId });
  });

  // Join room for vendor updates
  socket.on('join:vendor', (vendorId: string) => {
    socket.join(`vendor:${vendorId}`);
    logger.debug('Joined vendor room', { socketId: socket.id, vendorId });
  });

  // Handle delivery location updates
  socket.on(SocketEvents.DELIVERY_LOCATION_UPDATE, (data: { orderId: string; location: { lat: number; lng: number } }) => {
    // Broadcast to order room
    io.to(`order:${data.orderId}`).emit(SocketEvents.DELIVERY_LOCATION_UPDATE, data);
    logger.debug('Delivery location update', { orderId: data.orderId });
  });

  // Handle disconnection
  socket.on(SocketEvents.DISCONNECT, (reason) => {
    logger.info('Client disconnected', { socketId: socket.id, reason });
  });

  // Handle errors
  socket.on(SocketEvents.ERROR, (error: Error) => {
    logger.error('Socket error', { socketId: socket.id, error: error.message });
  });
});

// Export io for use in other modules
export { io };

// Graceful shutdown handler
const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      // Close all socket connections
      io.close(() => {
        logger.info('Socket.IO server closed');
      });

      // Disconnect from database
      await disconnectDatabase();
      logger.info('Database connection closed');

      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown:', { error });
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 30000);
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', { error: error.message, stack: error.stack });
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled Rejection:', { reason });
  gracefulShutdown('unhandledRejection');
});

// Start server
const startServer = async (): Promise<void> => {
  try {
    // Connect to MongoDB
    await connectDatabase();

    // Start listening
    server.listen(PORT, HOST, () => {
      logger.info(`Server started`, {
        host: HOST,
        port: PORT,
        environment: process.env['NODE_ENV'] ?? 'development',
        nodeVersion: process.version,
      });
      logger.info(`Health check available at http://${HOST}:${PORT}/health`);
      logger.info(`API available at http://${HOST}:${PORT}/api/v1`);
    });
  } catch (error) {
    logger.error('Failed to start server:', { error });
    process.exit(1);
  }
};

// Start the server
startServer();
