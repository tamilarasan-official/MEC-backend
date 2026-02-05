import 'dotenv/config';
import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import app from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { logger } from './config/logger.js';
import { SocketEvents, JwtConfig } from './config/constants.js';
import { orderEvents } from './modules/orders/order.events.js';
import { Order } from './modules/orders/order.model.js';

// Socket authentication middleware types
interface SocketUser {
  id: string;
  role: string;
  email: string;
  shopId?: string;
}

interface AuthenticatedSocket extends Socket {
  data: {
    user?: SocketUser;
  };
}

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

// Initialize order events with Socket.IO instance
orderEvents.initialize(io);
logger.info('Order events system initialized with Socket.IO');

// Socket.IO authentication middleware
io.use((socket: AuthenticatedSocket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;

  // Allow connection without token for public events, but mark as unauthenticated
  if (!token) {
    logger.debug('Socket connection without token', { socketId: socket.id });
    return next();
  }

  try {
    const secret = process.env['JWT_ACCESS_SECRET'] || process.env['JWT_SECRET'];
    if (!secret) {
      logger.error('JWT secret not configured for socket authentication');
      return next(new Error('Server configuration error'));
    }

    const decoded = jwt.verify(token as string, secret, {
      issuer: JwtConfig.ISSUER,
      audience: JwtConfig.AUDIENCE,
    }) as { sub: string; role: string; email: string; shopId?: string };

    socket.data.user = {
      id: decoded.sub,
      role: decoded.role,
      email: decoded.email,
      shopId: decoded.shopId,
    };

    logger.debug('Socket authenticated', { socketId: socket.id, userId: decoded.sub, role: decoded.role });
    next();
  } catch (err) {
    logger.warn('Socket authentication failed', { socketId: socket.id, error: err instanceof Error ? err.message : 'Unknown error' });
    next(new Error('Authentication failed'));
  }
});

// Socket.IO connection handling
io.on(SocketEvents.CONNECT, (socket: AuthenticatedSocket) => {
  const user = socket.data.user;
  logger.info('Client connected', { socketId: socket.id, userId: user?.id, role: user?.role });

  // Join room for order updates (with authorization)
  socket.on('join:order', async (orderId: string) => {
    if (!user) {
      socket.emit('error', { message: 'Authentication required to join order room' });
      return;
    }

    try {
      // Validate orderId format
      if (!/^[0-9a-fA-F]{24}$/.test(orderId)) {
        socket.emit('error', { message: 'Invalid order ID format' });
        return;
      }

      // Verify user has access to this order
      const order = await Order.findById(orderId).select('user shop');
      if (!order) {
        socket.emit('error', { message: 'Order not found' });
        return;
      }

      const isOrderOwner = order.user.toString() === user.id;
      const isShopStaff = user.shopId && order.shop.toString() === user.shopId;
      const isAdmin = ['accountant', 'superadmin'].includes(user.role);

      if (!isOrderOwner && !isShopStaff && !isAdmin) {
        socket.emit('error', { message: 'Not authorized to access this order' });
        logger.warn('Unauthorized order room access attempt', { socketId: socket.id, userId: user.id, orderId });
        return;
      }

      socket.join(`order:${orderId}`);
      socket.emit('joined:order', { orderId });
      logger.debug('Joined order room', { socketId: socket.id, userId: user.id, orderId });
    } catch (error) {
      logger.error('Error joining order room', { socketId: socket.id, error: error instanceof Error ? error.message : 'Unknown error' });
      socket.emit('error', { message: 'Failed to join order room' });
    }
  });

  // Leave order room
  socket.on('leave:order', (orderId: string) => {
    socket.leave(`order:${orderId}`);
    logger.debug('Left order room', { socketId: socket.id, orderId });
  });

  // Join room for vendor updates (with authorization)
  socket.on('join:vendor', (vendorId: string) => {
    if (!user) {
      socket.emit('error', { message: 'Authentication required to join vendor room' });
      return;
    }

    // Only shop staff can join their own vendor room
    const isShopStaff = user.shopId && user.shopId === vendorId;
    const isAdmin = ['accountant', 'superadmin'].includes(user.role);

    if (!isShopStaff && !isAdmin) {
      socket.emit('error', { message: 'Not authorized to access this vendor room' });
      logger.warn('Unauthorized vendor room access attempt', { socketId: socket.id, userId: user.id, vendorId });
      return;
    }

    socket.join(`vendor:${vendorId}`);
    socket.emit('joined:vendor', { vendorId });
    logger.debug('Joined vendor room', { socketId: socket.id, userId: user.id, vendorId });
  });

  // Join user room for personal notifications (students, all users)
  socket.on('join:user', (userId: string) => {
    if (!user) {
      socket.emit('error', { message: 'Authentication required to join user room' });
      return;
    }

    // Users can only join their own room
    if (userId !== user.id) {
      socket.emit('error', { message: 'Cannot join another user\'s room' });
      return;
    }

    socket.join(`user:${userId}`);
    socket.emit('joined:user', { userId });
    logger.debug('Joined user room', { socketId: socket.id, userId: user.id });
  });

  // Join shop room for shop staff (captains, owners)
  socket.on('join:shop', (shopId: string) => {
    if (!user) {
      socket.emit('error', { message: 'Authentication required to join shop room' });
      return;
    }

    // Only shop staff can join their own shop room
    const isShopStaff = user.shopId && user.shopId === shopId;
    const isAdmin = ['accountant', 'superadmin'].includes(user.role);

    if (!isShopStaff && !isAdmin) {
      socket.emit('error', { message: 'Not authorized to access this shop room' });
      logger.warn('Unauthorized shop room access attempt', { socketId: socket.id, userId: user.id, shopId });
      return;
    }

    socket.join(`shop:${shopId}`);
    socket.emit('joined:shop', { shopId });
    logger.debug('Joined shop room', { socketId: socket.id, userId: user.id, shopId });
  });

  // Handle delivery location updates (requires authentication)
  socket.on(SocketEvents.DELIVERY_LOCATION_UPDATE, (data: { orderId: string; location: { lat: number; lng: number } }) => {
    if (!user) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    // Broadcast to order room
    io.to(`order:${data.orderId}`).emit(SocketEvents.DELIVERY_LOCATION_UPDATE, data);
    logger.debug('Delivery location update', { orderId: data.orderId, userId: user.id });
  });

  // Handle disconnection
  socket.on(SocketEvents.DISCONNECT, (reason) => {
    logger.info('Client disconnected', { socketId: socket.id, userId: user?.id, reason });
  });

  // Handle errors
  socket.on(SocketEvents.ERROR, (error: Error) => {
    logger.error('Socket error', { socketId: socket.id, userId: user?.id, error: error.message });
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
      logger.info('='.repeat(60));
      logger.info('MEC Food App Backend Started');
      logger.info('='.repeat(60));
      logger.info(`Version: 1.1.0 (Build: 2026-02-05)`);
      logger.info(`Features: route-ordering-fix, owner-role-access, jwt-env-config`);
      logger.info('-'.repeat(60));
      logger.info(`Host: ${HOST}`);
      logger.info(`Port: ${PORT}`);
      logger.info(`Environment: ${process.env['NODE_ENV'] ?? 'development'}`);
      logger.info(`Node: ${process.version}`);
      logger.info('-'.repeat(60));
      logger.info(`Health: http://${HOST}:${PORT}/health`);
      logger.info(`Version: http://${HOST}:${PORT}/version`);
      logger.info(`API: http://${HOST}:${PORT}/api/v1`);
      logger.info('='.repeat(60));
      logger.info('Key Routes:');
      logger.info('  GET /api/v1/orders/shop/analytics - Shop analytics (captain, owner, superadmin)');
      logger.info('  GET /api/v1/accountant/students - Student list (accountant, owner, captain, superadmin)');
      logger.info('='.repeat(60));
    });
  } catch (error) {
    logger.error('Failed to start server:', { error });
    process.exit(1);
  }
};

// Start the server
startServer();
