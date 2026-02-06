/**
 * Swagger API Documentation Configuration
 * Comprehensive documentation for MEC Food App API
 */

import swaggerJsdoc from 'swagger-jsdoc';

const API_VERSION = '1.3.0';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MEC Food App API',
      version: API_VERSION,
      description: `
## MEC Food App Backend API Documentation

This API provides endpoints for:
- **Authentication**: User registration, login, token refresh
- **Menu Management**: Food items, categories, offers
- **Shop Management**: Shop CRUD operations
- **Order Management**: Create, update, track orders
- **Wallet**: Student wallet operations
- **Superadmin**: Dashboard stats, user management

### Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
\`\`\`
Authorization: Bearer <your-access-token>
\`\`\`

### Rate Limiting
- General: 100 requests per 15 minutes
- Auth endpoints: 10 requests per 15 minutes
- Registration: 5 requests per hour
      `,
      contact: {
        name: 'MEC Team',
        email: 'support@mecfoodapp.welocalhost.com',
      },
    },
    servers: [
      {
        url: 'https://backend.mec.welocalhost.com/api/v1',
        description: 'Production Server',
      },
      {
        url: 'http://localhost:5000/api/v1',
        description: 'Development Server',
      },
    ],
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Menu', description: 'Menu items and categories (Public)' },
      { name: 'Shops', description: 'Shop management' },
      { name: 'Orders', description: 'Order management' },
      { name: 'Student', description: 'Student-specific endpoints' },
      { name: 'Wallet', description: 'Wallet and transactions' },
      { name: 'Owner', description: 'Shop owner endpoints' },
      { name: 'Captain', description: 'Order captain endpoints' },
      { name: 'Accountant', description: 'Accountant endpoints' },
      { name: 'Superadmin', description: 'Superadmin management' },
      { name: 'Uploads', description: 'File upload endpoints' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token',
        },
      },
      schemas: {
        // Common Response Schemas
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' },
            message: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                message: { type: 'string', example: 'Validation failed' },
                details: { type: 'object' },
              },
            },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },

        // User Schemas
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '507f1f77bcf86cd799439011' },
            name: { type: 'string', example: 'John Doe' },
            email: { type: 'string', format: 'email', example: 'john@example.com' },
            phone: { type: 'string', example: '+91 9876543210' },
            role: {
              type: 'string',
              enum: ['student', 'captain', 'owner', 'accountant', 'superadmin'],
              example: 'student'
            },
            balance: { type: 'number', example: 500.00 },
            rollNumber: { type: 'string', example: 'MEC2024001' },
            department: { type: 'string', example: 'Computer Science' },
            year: { type: 'integer', example: 3 },
            shopId: { type: 'string', example: '507f1f77bcf86cd799439012' },
            isApproved: { type: 'boolean', example: true },
            isActive: { type: 'boolean', example: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },

        // Auth Schemas
        LoginRequest: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: {
              type: 'string',
              description: 'Email or roll number',
              example: 'john@example.com'
            },
            password: {
              type: 'string',
              format: 'password',
              minLength: 6,
              example: 'password123'
            },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                user: { $ref: '#/components/schemas/User' },
                tokens: {
                  type: 'object',
                  properties: {
                    accessToken: { type: 'string' },
                    refreshToken: { type: 'string' },
                    expiresIn: { type: 'integer', example: 900 },
                  },
                },
              },
            },
            message: { type: 'string', example: 'Login successful' },
          },
        },
        RegisterRequest: {
          type: 'object',
          required: ['name', 'email', 'password', 'phone', 'rollNumber', 'department', 'year'],
          properties: {
            name: { type: 'string', minLength: 2, maxLength: 100, example: 'John Doe' },
            email: { type: 'string', format: 'email', example: 'john@example.com' },
            password: { type: 'string', format: 'password', minLength: 6, example: 'password123' },
            phone: { type: 'string', example: '+91 9876543210' },
            rollNumber: { type: 'string', example: 'MEC2024001' },
            department: { type: 'string', example: 'Computer Science' },
            year: { type: 'integer', minimum: 1, maximum: 5, example: 3 },
          },
        },
        RefreshTokenRequest: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          },
        },

        // Shop Schemas
        Shop: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '507f1f77bcf86cd799439012' },
            name: { type: 'string', example: 'MEC CANTEEN' },
            description: { type: 'string', example: 'Main campus canteen' },
            category: {
              type: 'string',
              enum: ['canteen', 'laundry', 'xerox', 'other'],
              example: 'canteen'
            },
            isActive: { type: 'boolean', example: true },
            ownerId: { type: 'string' },
            imageUrl: { type: 'string' },
            bannerUrl: { type: 'string' },
            rating: { type: 'number', example: 4.5 },
            totalOrders: { type: 'integer', example: 1250 },
            contactPhone: { type: 'string' },
          },
        },
        CreateShopRequest: {
          type: 'object',
          required: ['name', 'category'],
          properties: {
            name: { type: 'string', minLength: 2, maxLength: 100, example: 'New Canteen' },
            description: { type: 'string', maxLength: 500, example: 'A new food outlet' },
            category: {
              type: 'string',
              enum: ['canteen', 'laundry', 'xerox', 'other'],
              example: 'canteen'
            },
            ownerId: { type: 'string' },
            contactPhone: { type: 'string' },
          },
        },

        // Food Item Schemas
        FoodItem: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '507f1f77bcf86cd799439013' },
            name: { type: 'string', example: 'Chicken Biryani' },
            description: { type: 'string', example: 'Aromatic rice with tender chicken' },
            price: { type: 'number', example: 120 },
            costPrice: { type: 'number', example: 80 },
            image: { type: 'string', example: 'https://example.com/biryani.jpg' },
            imageUrl: { type: 'string' },
            category: { type: 'string', example: 'Lunch' },
            shopId: { type: 'string' },
            shopName: { type: 'string', example: 'MEC CANTEEN' },
            isAvailable: { type: 'boolean', example: true },
            isOffer: { type: 'boolean', example: false },
            offerPrice: { type: 'number', example: 99 },
            rating: { type: 'number', example: 4.2 },
            preparationTime: { type: 'string', example: '15 min' },
          },
        },
        CreateFoodItemRequest: {
          type: 'object',
          required: ['name', 'price'],
          properties: {
            name: { type: 'string', minLength: 2, maxLength: 100, example: 'Chicken Biryani' },
            description: { type: 'string', maxLength: 500, example: 'Aromatic rice with tender chicken' },
            price: { type: 'number', minimum: 0, example: 120 },
            costPrice: { type: 'number', minimum: 0, example: 80 },
            categoryId: { type: 'string', example: '507f1f77bcf86cd799439014' },
            imageUrl: { type: 'string' },
            preparationTime: { type: 'integer', minimum: 1, maximum: 180, example: 15 },
            isVegetarian: { type: 'boolean', example: false },
            isAvailable: { type: 'boolean', example: true },
          },
        },

        // Category Schemas
        Category: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string', example: 'Lunch' },
            description: { type: 'string', example: 'Lunch items' },
            shop: { type: 'string' },
            sortOrder: { type: 'integer', example: 1 },
            isActive: { type: 'boolean', example: true },
          },
        },
        CreateCategoryRequest: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 2, maxLength: 50, example: 'Breakfast' },
            description: { type: 'string', maxLength: 200, example: 'Morning breakfast items' },
            sortOrder: { type: 'integer', minimum: 0, example: 1 },
          },
        },

        // Order Schemas
        Order: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
            userName: { type: 'string', example: 'John Doe' },
            shopId: { type: 'string' },
            shopName: { type: 'string', example: 'MEC CANTEEN' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  foodItemId: { type: 'string' },
                  name: { type: 'string' },
                  price: { type: 'number' },
                  quantity: { type: 'integer' },
                },
              },
            },
            total: { type: 'number', example: 250 },
            status: {
              type: 'string',
              enum: ['pending', 'preparing', 'ready', 'completed', 'cancelled'],
              example: 'pending',
            },
            pickupToken: { type: 'string', example: 'ABC123' },
            notes: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            completedAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateOrderRequest: {
          type: 'object',
          required: ['shopId', 'items'],
          properties: {
            shopId: { type: 'string', example: '507f1f77bcf86cd799439012' },
            items: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                required: ['foodItemId', 'quantity'],
                properties: {
                  foodItemId: { type: 'string', example: '507f1f77bcf86cd799439013' },
                  quantity: { type: 'integer', minimum: 1, example: 2 },
                },
              },
            },
            notes: { type: 'string', maxLength: 500, example: 'Extra spicy please' },
          },
        },
        UpdateOrderStatusRequest: {
          type: 'object',
          required: ['status'],
          properties: {
            status: {
              type: 'string',
              enum: ['pending', 'preparing', 'ready', 'completed', 'cancelled'],
              example: 'preparing',
            },
          },
        },

        // Wallet Schemas
        Transaction: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
            type: { type: 'string', enum: ['credit', 'debit'], example: 'credit' },
            amount: { type: 'number', example: 500 },
            description: { type: 'string', example: 'Wallet recharge' },
            balanceAfter: { type: 'number', example: 1000 },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        AddFundsRequest: {
          type: 'object',
          required: ['userId', 'amount'],
          properties: {
            userId: { type: 'string', example: '507f1f77bcf86cd799439011' },
            amount: { type: 'number', minimum: 1, example: 500 },
            description: { type: 'string', example: 'Cash deposit' },
          },
        },

        // Dashboard Stats
        DashboardStats: {
          type: 'object',
          properties: {
            totalOrders: { type: 'integer', example: 1250 },
            totalRevenue: { type: 'number', example: 125000 },
            activeStudents: { type: 'integer', example: 500 },
            pendingOrders: { type: 'integer', example: 15 },
            todayOrders: { type: 'integer', example: 45 },
            todayRevenue: { type: 'number', example: 4500 },
          },
        },

        // Offer Schema
        SetOfferRequest: {
          type: 'object',
          required: ['offerPrice', 'offerEndDate'],
          properties: {
            offerPrice: { type: 'number', minimum: 0, example: 99 },
            offerEndDate: { type: 'string', format: 'date-time', example: '2026-03-01T23:59:59Z' },
          },
        },

        // Upload Response
        UploadResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                url: { type: 'string', example: 'https://storage.example.com/image.jpg' },
                key: { type: 'string', example: 'uploads/image-123.jpg' },
              },
            },
          },
        },
      },
    },
    paths: {
      // ============================================
      // AUTH ENDPOINTS
      // ============================================
      '/auth/register': {
        post: {
          tags: ['Auth'],
          summary: 'Register a new student account',
          description: 'Create a new student account. Account needs to be approved by accountant before login.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RegisterRequest' },
              },
            },
          },
          responses: {
            201: {
              description: 'Registration successful',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: { $ref: '#/components/schemas/User' },
                      message: { type: 'string', example: 'Registration successful. Please wait for approval.' },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Validation error',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            409: {
              description: 'User already exists',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
      '/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Login to get access token',
          description: 'Authenticate with email/roll number and password to receive JWT tokens.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoginRequest' },
              },
            },
          },
          responses: {
            200: {
              description: 'Login successful',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/LoginResponse' },
                },
              },
            },
            401: {
              description: 'Invalid credentials',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            403: {
              description: 'Account not approved or deactivated',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
      '/auth/refresh': {
        post: {
          tags: ['Auth'],
          summary: 'Refresh access token',
          description: 'Get a new access token using refresh token.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RefreshTokenRequest' },
              },
            },
          },
          responses: {
            200: {
              description: 'Token refreshed',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          tokens: {
                            type: 'object',
                            properties: {
                              accessToken: { type: 'string' },
                              refreshToken: { type: 'string' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            401: {
              description: 'Invalid refresh token',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
      '/auth/logout': {
        post: {
          tags: ['Auth'],
          summary: 'Logout current user',
          description: 'Invalidate the current session.',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Logout successful',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Logged out successfully' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/auth/me': {
        get: {
          tags: ['Auth'],
          summary: 'Get current user info',
          description: 'Get the authenticated user\'s information.',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'User information',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: { $ref: '#/components/schemas/User' },
                    },
                  },
                },
              },
            },
            401: {
              description: 'Unauthorized',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },

      // ============================================
      // MENU ENDPOINTS (PUBLIC)
      // ============================================
      '/menu/items': {
        get: {
          tags: ['Menu'],
          summary: 'Get all available menu items',
          description: 'Get all available food items from all active shops. Public endpoint.',
          responses: {
            200: {
              description: 'List of menu items',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          items: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/FoodItem' },
                          },
                        },
                      },
                      meta: {
                        type: 'object',
                        properties: {
                          count: { type: 'integer', example: 50 },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/menu/offers': {
        get: {
          tags: ['Menu'],
          summary: 'Get all active offers',
          description: 'Get all food items with active offers from all shops.',
          responses: {
            200: {
              description: 'List of offers',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          items: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/FoodItem' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },

      // ============================================
      // SHOPS ENDPOINTS
      // ============================================
      '/shops': {
        get: {
          tags: ['Shops'],
          summary: 'Get all shops',
          description: 'Get list of all active shops.',
          parameters: [
            {
              name: 'activeOnly',
              in: 'query',
              description: 'Filter only active shops',
              schema: { type: 'boolean', default: true },
            },
          ],
          responses: {
            200: {
              description: 'List of shops',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          shops: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/Shop' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/shops/{shopId}': {
        get: {
          tags: ['Shops'],
          summary: 'Get shop by ID',
          description: 'Get details of a specific shop.',
          parameters: [
            {
              name: 'shopId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Shop ID',
            },
          ],
          responses: {
            200: {
              description: 'Shop details',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: { $ref: '#/components/schemas/Shop' },
                    },
                  },
                },
              },
            },
            404: {
              description: 'Shop not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
      '/shops/{shopId}/menu': {
        get: {
          tags: ['Shops'],
          summary: 'Get shop menu items',
          description: 'Get all menu items for a specific shop.',
          parameters: [
            {
              name: 'shopId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
            {
              name: 'categoryId',
              in: 'query',
              schema: { type: 'string' },
              description: 'Filter by category',
            },
            {
              name: 'availableOnly',
              in: 'query',
              schema: { type: 'boolean', default: true },
            },
          ],
          responses: {
            200: {
              description: 'Shop menu items',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/FoodItem' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/shops/{shopId}/categories': {
        get: {
          tags: ['Shops'],
          summary: 'Get shop categories',
          description: 'Get all categories for a specific shop.',
          parameters: [
            {
              name: 'shopId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            200: {
              description: 'Shop categories',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Category' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },

      // ============================================
      // ORDER ENDPOINTS
      // ============================================
      '/orders': {
        post: {
          tags: ['Orders'],
          summary: 'Create a new order',
          description: 'Place a new order. Requires student authentication.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateOrderRequest' },
              },
            },
          },
          responses: {
            201: {
              description: 'Order created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          order: { $ref: '#/components/schemas/Order' },
                        },
                      },
                      message: { type: 'string', example: 'Order placed successfully' },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Insufficient balance or validation error',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
      '/orders/my': {
        get: {
          tags: ['Orders', 'Student'],
          summary: 'Get my orders',
          description: 'Get all orders for the authenticated student.',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'List of orders',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Order' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/orders/shop': {
        get: {
          tags: ['Orders', 'Captain', 'Owner'],
          summary: 'Get shop orders',
          description: 'Get all orders for the user\'s assigned shop. For captain/owner roles.',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'status',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['pending', 'preparing', 'ready', 'completed', 'cancelled'],
              },
            },
          ],
          responses: {
            200: {
              description: 'List of shop orders',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          orders: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/Order' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/orders/{orderId}/status': {
        put: {
          tags: ['Orders', 'Captain'],
          summary: 'Update order status',
          description: 'Update the status of an order. For captain/owner roles.',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'orderId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UpdateOrderStatusRequest' },
              },
            },
          },
          responses: {
            200: {
              description: 'Order status updated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          order: { $ref: '#/components/schemas/Order' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },

      // ============================================
      // WALLET ENDPOINTS
      // ============================================
      '/student/wallet': {
        get: {
          tags: ['Wallet', 'Student'],
          summary: 'Get wallet balance',
          description: 'Get the current wallet balance for the authenticated student.',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Wallet balance',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          balance: { type: 'number', example: 500 },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/student/wallet/transactions': {
        get: {
          tags: ['Wallet', 'Student'],
          summary: 'Get wallet transactions',
          description: 'Get transaction history for the authenticated student.',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Transaction history',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          transactions: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/Transaction' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/accountant/add-funds': {
        post: {
          tags: ['Wallet', 'Accountant'],
          summary: 'Add funds to student wallet',
          description: 'Add funds to a student\'s wallet. For accountant role.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AddFundsRequest' },
              },
            },
          },
          responses: {
            200: {
              description: 'Funds added',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          transaction: { $ref: '#/components/schemas/Transaction' },
                          newBalance: { type: 'number', example: 1000 },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },

      // ============================================
      // ACCOUNTANT ENDPOINTS
      // ============================================
      '/accountant/students': {
        get: {
          tags: ['Accountant'],
          summary: 'Get all students',
          description: 'Get list of all students. For accountant role.',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'List of students',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/User' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/accountant/pending-approvals': {
        get: {
          tags: ['Accountant'],
          summary: 'Get pending student approvals',
          description: 'Get students waiting for approval.',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Pending students',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/User' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/accountant/approve/{userId}': {
        put: {
          tags: ['Accountant'],
          summary: 'Approve student registration',
          description: 'Approve a pending student registration.',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'userId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    initialBalance: { type: 'number', example: 0 },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Student approved',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Student approved successfully' },
                    },
                  },
                },
              },
            },
          },
        },
      },

      // ============================================
      // OWNER ENDPOINTS
      // ============================================
      '/owner/menu': {
        post: {
          tags: ['Owner'],
          summary: 'Add menu item to shop',
          description: 'Add a new food item to owner\'s shop.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateFoodItemRequest' },
              },
            },
          },
          responses: {
            201: {
              description: 'Food item created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: { $ref: '#/components/schemas/FoodItem' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/owner/menu/{id}': {
        put: {
          tags: ['Owner'],
          summary: 'Update menu item',
          description: 'Update a food item in owner\'s shop.',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateFoodItemRequest' },
              },
            },
          },
          responses: {
            200: {
              description: 'Food item updated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: { $ref: '#/components/schemas/FoodItem' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/owner/menu/{id}/availability': {
        patch: {
          tags: ['Owner'],
          summary: 'Toggle item availability',
          description: 'Toggle the availability status of a menu item.',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            200: {
              description: 'Availability toggled',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: { $ref: '#/components/schemas/FoodItem' },
                      message: { type: 'string', example: 'Item marked unavailable' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/owner/menu/{id}/offer': {
        post: {
          tags: ['Owner'],
          summary: 'Set offer on item',
          description: 'Set a discount offer on a menu item.',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SetOfferRequest' },
              },
            },
          },
          responses: {
            200: {
              description: 'Offer set',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: { $ref: '#/components/schemas/FoodItem' },
                    },
                  },
                },
              },
            },
          },
        },
        delete: {
          tags: ['Owner'],
          summary: 'Remove offer from item',
          description: 'Remove the discount offer from a menu item.',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            200: {
              description: 'Offer removed',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: { $ref: '#/components/schemas/FoodItem' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/owner/categories': {
        post: {
          tags: ['Owner'],
          summary: 'Create category',
          description: 'Create a new category for owner\'s shop.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateCategoryRequest' },
              },
            },
          },
          responses: {
            201: {
              description: 'Category created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: { $ref: '#/components/schemas/Category' },
                    },
                  },
                },
              },
            },
          },
        },
      },

      // ============================================
      // SUPERADMIN ENDPOINTS
      // ============================================
      '/superadmin/dashboard/stats': {
        get: {
          tags: ['Superadmin'],
          summary: 'Get dashboard statistics',
          description: 'Get overall statistics for the superadmin dashboard.',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Dashboard statistics',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: { $ref: '#/components/schemas/DashboardStats' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/superadmin/menu': {
        get: {
          tags: ['Superadmin'],
          summary: 'Get all menu items (including unavailable)',
          description: 'Get ALL menu items including unavailable ones. For admin management.',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'All menu items',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          items: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/FoodItem' },
                          },
                        },
                      },
                      meta: {
                        type: 'object',
                        properties: {
                          count: { type: 'integer' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['Superadmin'],
          summary: 'Add menu item to any shop',
          description: 'Add a food item to any shop.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/CreateFoodItemRequest' },
                    {
                      type: 'object',
                      required: ['shopId'],
                      properties: {
                        shopId: { type: 'string', example: '507f1f77bcf86cd799439012' },
                      },
                    },
                  ],
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Food item created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: { $ref: '#/components/schemas/FoodItem' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/superadmin/menu/{id}': {
        put: {
          tags: ['Superadmin'],
          summary: 'Update any menu item',
          description: 'Update any food item.',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateFoodItemRequest' },
              },
            },
          },
          responses: {
            200: {
              description: 'Food item updated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: { $ref: '#/components/schemas/FoodItem' },
                    },
                  },
                },
              },
            },
          },
        },
        delete: {
          tags: ['Superadmin'],
          summary: 'Delete any menu item',
          description: 'Delete any food item.',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            200: {
              description: 'Food item deleted',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Food item deleted successfully' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/superadmin/shops': {
        post: {
          tags: ['Superadmin'],
          summary: 'Create a new shop',
          description: 'Create a new shop.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateShopRequest' },
              },
            },
          },
          responses: {
            201: {
              description: 'Shop created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: { $ref: '#/components/schemas/Shop' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/superadmin/shops/{id}': {
        put: {
          tags: ['Superadmin'],
          summary: 'Update shop',
          description: 'Update shop details.',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateShopRequest' },
              },
            },
          },
          responses: {
            200: {
              description: 'Shop updated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: { $ref: '#/components/schemas/Shop' },
                    },
                  },
                },
              },
            },
          },
        },
        delete: {
          tags: ['Superadmin'],
          summary: 'Deactivate shop',
          description: 'Deactivate a shop (soft delete).',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            200: {
              description: 'Shop deactivated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Shop deactivated successfully' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/superadmin/shops/{id}/toggle': {
        patch: {
          tags: ['Superadmin'],
          summary: 'Toggle shop status',
          description: 'Toggle shop active/inactive status.',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            200: {
              description: 'Shop status toggled',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: { $ref: '#/components/schemas/Shop' },
                      message: { type: 'string', example: 'Shop activated successfully' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/superadmin/users': {
        get: {
          tags: ['Superadmin'],
          summary: 'Get all users',
          description: 'Get list of all users in the system.',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'List of users',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          users: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/User' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/superadmin/orders': {
        get: {
          tags: ['Superadmin'],
          summary: 'Get all orders',
          description: 'Get all orders across all shops.',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'All orders',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          orders: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/Order' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/superadmin/categories': {
        post: {
          tags: ['Superadmin'],
          summary: 'Create category for any shop',
          description: 'Create a category for any shop.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/CreateCategoryRequest' },
                    {
                      type: 'object',
                      required: ['shopId'],
                      properties: {
                        shopId: { type: 'string' },
                      },
                    },
                  ],
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Category created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: { $ref: '#/components/schemas/Category' },
                    },
                  },
                },
              },
            },
          },
        },
      },

      // ============================================
      // UPLOAD ENDPOINTS
      // ============================================
      '/uploads/presigned-url': {
        post: {
          tags: ['Uploads'],
          summary: 'Get presigned URL for upload',
          description: 'Get a presigned URL to upload a file to S3.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['filename', 'contentType'],
                  properties: {
                    filename: { type: 'string', example: 'image.jpg' },
                    contentType: { type: 'string', example: 'image/jpeg' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Presigned URL generated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          uploadUrl: { type: 'string' },
                          publicUrl: { type: 'string' },
                          key: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  apis: [], // We're defining all paths inline above
};

export const swaggerSpec = swaggerJsdoc(options);
export default swaggerSpec;
