import swaggerJSDoc from 'swagger-jsdoc';
import { config } from '../config/environment';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'N8N StreamDeck API',
      version: '1.0.0',
      description:
        'REST API for N8N StreamDeck integration - manage StreamDeck devices, buttons, and N8N workflow triggers',
      contact: {
        name: 'API Support',
        email: 'support@n8n-streamdeck.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Development server',
      },
      {
        url: 'https://api.n8n-streamdeck.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token for authentication',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'refreshToken',
          description: 'Refresh token stored in HTTP-only cookie',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          required: ['success', 'error', 'timestamp', 'requestId'],
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: {
                  type: 'string',
                  example: 'VALIDATION_ERROR',
                },
                message: {
                  type: 'string',
                  example: 'Invalid request parameters',
                },
                details: {
                  type: 'object',
                  description: 'Additional error details',
                },
              },
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T00:00:00.000Z',
            },
            requestId: {
              type: 'string',
              example: 'req_123456789',
            },
          },
        },
        Device: {
          type: 'object',
          required: ['id', 'name', 'type', 'connected', 'buttonCount'],
          properties: {
            id: {
              type: 'string',
              description: 'Unique device identifier',
              example: 'streamdeck_001',
            },
            name: {
              type: 'string',
              description: 'Device display name',
              example: 'StreamDeck MK.2',
            },
            type: {
              type: 'string',
              description: 'Device model type',
              example: 'streamdeck-mk2',
            },
            connected: {
              type: 'boolean',
              description: 'Device connection status',
              example: true,
            },
            buttonCount: {
              type: 'integer',
              description: 'Number of buttons on device',
              example: 15,
            },
            brightness: {
              type: 'integer',
              minimum: 0,
              maximum: 100,
              description: 'Device brightness percentage',
              example: 80,
            },
            serialNumber: {
              type: 'string',
              description: 'Device serial number',
              example: 'CL12345678',
            },
            firmwareVersion: {
              type: 'string',
              description: 'Device firmware version',
              example: '1.0.3',
            },
          },
        },
        Button: {
          type: 'object',
          required: ['id', 'deviceId', 'position', 'enabled'],
          properties: {
            id: {
              type: 'string',
              description: 'Unique button identifier',
              example: 'btn_001',
            },
            deviceId: {
              type: 'string',
              description: 'Parent device identifier',
              example: 'streamdeck_001',
            },
            position: {
              type: 'integer',
              description: 'Button position on device (0-based)',
              example: 0,
            },
            enabled: {
              type: 'boolean',
              description: 'Button enabled status',
              example: true,
            },
            title: {
              type: 'string',
              description: 'Button display title',
              example: 'Deploy App',
            },
            icon: {
              type: 'string',
              description: 'Button icon (base64 encoded image)',
              example:
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
            },
            n8nWorkflowId: {
              type: 'string',
              description: 'Associated N8N workflow ID',
              example: 'wf_123456',
            },
            n8nWebhookUrl: {
              type: 'string',
              format: 'uri',
              description: 'N8N webhook URL for triggering workflow',
              example: 'https://n8n.example.com/webhook/streamdeck-trigger',
            },
            backgroundColor: {
              type: 'string',
              pattern: '^#[0-9A-Fa-f]{6}$',
              description: 'Button background color (hex)',
              example: '#FF0000',
            },
          },
        },
        AuthSetup: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: {
              type: 'string',
              minLength: 3,
              maxLength: 50,
              description: 'Admin username',
              example: 'admin',
            },
            password: {
              type: 'string',
              minLength: 8,
              description: 'Admin password (minimum 8 characters)',
              example: 'securePassword123',
            },
          },
        },
        AuthLogin: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: {
              type: 'string',
              description: 'Username',
              example: 'admin',
            },
            password: {
              type: 'string',
              description: 'Password',
              example: 'securePassword123',
            },
          },
        },
        AuthResponse: {
          type: 'object',
          required: ['success', 'data', 'timestamp'],
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              type: 'object',
              required: ['accessToken', 'user'],
              properties: {
                accessToken: {
                  type: 'string',
                  description: 'JWT access token',
                  example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                },
                user: {
                  type: 'object',
                  required: ['id', 'username', 'role'],
                  properties: {
                    id: {
                      type: 'string',
                      example: 'user_123',
                    },
                    username: {
                      type: 'string',
                      example: 'admin',
                    },
                    role: {
                      type: 'string',
                      enum: ['admin', 'user'],
                      example: 'admin',
                    },
                  },
                },
              },
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T00:00:00.000Z',
            },
          },
        },
        HealthCheck: {
          type: 'object',
          required: ['status', 'timestamp', 'version'],
          properties: {
            status: {
              type: 'string',
              enum: ['healthy', 'unhealthy'],
              example: 'healthy',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T00:00:00.000Z',
            },
            version: {
              type: 'string',
              example: '1.0.0',
            },
            uptime: {
              type: 'number',
              description: 'Server uptime in seconds',
              example: 3600,
            },
            services: {
              type: 'object',
              properties: {
                streamdeck: {
                  type: 'object',
                  properties: {
                    status: {
                      type: 'string',
                      enum: ['connected', 'disconnected', 'error'],
                      example: 'connected',
                    },
                    devicesConnected: {
                      type: 'integer',
                      example: 2,
                    },
                  },
                },
                n8n: {
                  type: 'object',
                  properties: {
                    status: {
                      type: 'string',
                      enum: ['connected', 'disconnected', 'error'],
                      example: 'connected',
                    },
                    url: {
                      type: 'string',
                      format: 'uri',
                      example: 'https://n8n.example.com',
                    },
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                error: {
                  code: 'UNAUTHORIZED',
                  message: 'Authentication required',
                },
                timestamp: '2024-01-01T00:00:00.000Z',
                requestId: 'req_123456789',
              },
            },
          },
        },
        ForbiddenError: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                error: {
                  code: 'FORBIDDEN',
                  message: 'Insufficient permissions',
                },
                timestamp: '2024-01-01T00:00:00.000Z',
                requestId: 'req_123456789',
              },
            },
          },
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                error: {
                  code: 'NOT_FOUND',
                  message: 'Resource not found',
                },
                timestamp: '2024-01-01T00:00:00.000Z',
                requestId: 'req_123456789',
              },
            },
          },
        },
        ValidationError: {
          description: 'Invalid request data',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                error: {
                  code: 'VALIDATION_ERROR',
                  message: 'Invalid request parameters',
                  details: {
                    field: 'username',
                    message: 'Username is required',
                  },
                },
                timestamp: '2024-01-01T00:00:00.000Z',
                requestId: 'req_123456789',
              },
            },
          },
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                error: {
                  code: 'INTERNAL_ERROR',
                  message: 'An unexpected error occurred',
                },
                timestamp: '2024-01-01T00:00:00.000Z',
                requestId: 'req_123456789',
              },
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and session management',
      },
      {
        name: 'Devices',
        description: 'StreamDeck device management',
      },
      {
        name: 'Buttons',
        description: 'Button configuration and management',
      },
      {
        name: 'Configuration',
        description: 'Application configuration',
      },
      {
        name: 'Health',
        description: 'Health checks and monitoring',
      },
      {
        name: 'Errors',
        description: 'Error reporting and logging',
      },
    ],
  },
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts',
    './src/docs/paths/*.yaml',
  ],
};

export const swaggerSpec = swaggerJSDoc(options);
