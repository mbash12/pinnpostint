import swaggerJsdoc from 'swagger-jsdoc';
import { SwaggerDefinition } from 'swagger-jsdoc';

const swaggerDefinition: SwaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Pin N Post API',
    version: '1.0.0',
    description: `
      A comprehensive REST API for a classified ads platform built with Express.js, TypeScript, and Prisma.
      
      ## Features
      - User authentication with JWT and OTP verification
      - Ad creation, management, and moderation
      - Category and location management
      - Payment integration with Razorpay
      - Push notifications with Firebase
      - Booking system
      - Admin panel functionality
      
      ## Authentication
      Most endpoints require authentication. Include the JWT token in the Authorization header:
      \`Authorization: Bearer <your-jwt-token>\`
    `,
    contact: {
      name: 'Pin N Post API Support',
      email: 'support@pinnpost.com',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: `http://localhost:${process.env.PORT || 3001}`,
      description: 'Development server',
    },
    {
      url: 'https://api.pinnpost.com',
      description: 'Production server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT token obtained from login endpoint',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false,
          },
          error: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                example: 'VALIDATION_ERROR',
              },
              message: {
                type: 'string',
                example: 'Validation failed',
              },
              details: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    field: {
                      type: 'string',
                    },
                    message: {
                      type: 'string',
                    },
                  },
                },
              },
            },
          },
        },
      },
      SuccessResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true,
          },
          data: {
            type: 'object',
          },
          message: {
            type: 'string',
          },
          pagination: {
            type: 'object',
            properties: {
              page: {
                type: 'number',
              },
              limit: {
                type: 'number',
              },
              total: {
                type: 'number',
              },
              totalPages: {
                type: 'number',
              },
            },
          },
        },
      },
      Setting: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          key: {
            type: 'string',
          },
          value: {
            type: 'object',
          },
        },
        required: ['key', 'value'],
      },
      Location: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          name: {
            type: 'string',
          },
          address: {
            type: 'string',
          },
          latitude: {
            type: 'number',
            format: 'float',
          },
          longitude: {
            type: 'number',
            format: 'float',
          },
          city: {
            type: 'string',
          },
          state: {
            type: 'string',
          },
          country: {
            type: 'string',
          },
          postalCode: {
            type: 'string',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
        required: ['name', 'latitude', 'longitude'],
      },
      Category: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          name: {
            type: 'string',
          },
          slug: {
            type: 'string',
          },
          description: {
            type: 'string',
          },
          isActive: {
            type: 'boolean',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
          subcategories: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Subcategory',
            },
          },
          attributes: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Attribute',
            },
          },
        },
        required: ['name'],
      },
      Subcategory: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          name: {
            type: 'string',
          },
          slug: {
            type: 'string',
          },
          description: {
            type: 'string',
          },
          categoryId: {
            type: 'string',
            format: 'uuid',
          },
          isActive: {
            type: 'boolean',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
        required: ['name', 'categoryId'],
      },
      Attribute: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          name: {
            type: 'string',
          },
          type: {
            type: 'string',
            enum: ['text', 'number', 'boolean', 'select', 'textarea', 'date'],
          },
          options: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          categoryId: {
            type: 'string',
            format: 'uuid',
          },
          isRequired: {
            type: 'boolean',
          },
          order: {
            type: 'integer',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
        required: ['name', 'type', 'categoryId'],
      },
      User: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          phone: {
            type: 'string',
          },
          email: {
            type: 'string',
            format: 'email',
          },
          firstName: {
            type: 'string',
          },
          lastName: {
            type: 'string',
          },
          role: {
            type: 'string',
            enum: ['ADMIN', 'USER'],
          },
          isActive: {
            type: 'boolean',
          },
          isVerified: {
            type: 'boolean',
          },
          avatar: {
            type: 'string',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      Ad: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          title: {
            type: 'string',
          },
          description: {
            type: 'string',
          },
          price: {
            type: 'number',
            format: 'decimal',
          },
          status: {
            type: 'string',
            enum: ['PENDING', 'REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED'],
          },
          images: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          isFeatured: {
            type: 'boolean',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
          expiresAt: {
            type: 'string',
            format: 'date-time',
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
            },
          },
        },
      },
      ValidationError: {
        description: 'Validation error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Validation failed',
                details: [
                  {
                    field: 'key',
                    message: 'Key is required',
                  },
                ],
              },
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
            },
          },
        },
      },

    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
  tags: [
    {
      name: 'Authentication',
      description: 'User authentication and registration',
    },
    {
      name: 'Users',
      description: 'User profile management',
    },
    {
      name: 'Admin',
      description: 'Administrative operations',
    },
    {
      name: 'Ads',
      description: 'Advertisement management',
    },
    {
      name: 'Categories',
      description: 'Category and subcategory management',
    },
    {
      name: 'Locations',
      description: 'Location management',
    },
    {
      name: 'Bookings',
      description: 'Booking management',
    },
    {
      name: 'Payments',
      description: 'Payment and subscription management',
    },
    {
      name: 'Notifications',
      description: 'Push notification management',
    },
    {
      name: 'Content',
      description: 'Blog, FAQs, and content management',
    },
    {
      name: 'Public',
      description: 'Public endpoints (no authentication required)',
    },
  ],
};

const options = {
  definition: swaggerDefinition,
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts',
    './src/middleware/*.ts',
  ],
};

type SwaggerTag = string | (Record<string, unknown> & { name?: string });
type SwaggerOperation = Record<string, unknown> & { tags?: SwaggerTag[] };
type SwaggerPathItem = Record<string, SwaggerOperation> & {
  get?: SwaggerOperation;
  put?: SwaggerOperation;
  post?: SwaggerOperation;
  delete?: SwaggerOperation;
  options?: SwaggerOperation;
  head?: SwaggerOperation;
  patch?: SwaggerOperation;
  trace?: SwaggerOperation;
};

type SwaggerDocument = Record<string, unknown> & {
  paths?: Record<string, SwaggerPathItem | undefined>;
  tags?: SwaggerTag[];
};

const swaggerSpec = swaggerJsdoc(options) as SwaggerDocument;

const usedTags = new Set<string>();
const paths = swaggerSpec.paths ?? {};

Object.values(paths).forEach((pathItem) => {
  if (!pathItem || typeof pathItem !== 'object') return;

  Object.entries(pathItem).forEach(([key, value]) => {
    if (key === 'parameters') return;
    if (!value || typeof value !== 'object') return;

    const operation = value;
    operation.tags?.forEach((tag) => {
      const tagName = typeof tag === 'string' ? tag : tag?.name;
      if (tagName) {
        usedTags.add(tagName);
      }
    });
  });
});

const definedTags = Array.isArray(swaggerSpec.tags) ? swaggerSpec.tags : [];

type NormalizedTag = Record<string, unknown> & { name: string };

const normalizedTags = definedTags
  .map((tag) => {
    if (typeof tag === 'string') {
      return { name: tag } satisfies NormalizedTag;
    }
    if (tag && typeof tag === 'object' && typeof tag.name === 'string') {
      return tag as NormalizedTag;
    }
    return undefined;
  })
  .filter((tag): tag is NormalizedTag => Boolean(tag));

const filteredTags = normalizedTags.filter((tag) => usedTags.has(tag.name));

const missingTags = Array.from(usedTags).filter(
  (tagName) => !filteredTags.some((tag) => tag.name === tagName),
);

const finalTags: NormalizedTag[] = [
  ...filteredTags,
  ...missingTags.map((tagName) => ({ name: tagName })),
];

if (finalTags.length > 0) {
  swaggerSpec.tags = finalTags;
} else {
  delete swaggerSpec.tags;
}

export { swaggerSpec };
export default swaggerSpec;