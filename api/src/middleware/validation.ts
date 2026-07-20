import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ErrorCode, createErrorResponse, ValidationError } from '../types/api-responses';

/**
 * Middleware factory for request validation using Joi schemas
 */
export const validateRequest = (schema: {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: ValidationError[] = [];

    // Validate request body
    if (schema.body) {
      const { error } = schema.body.validate(req.body, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map(detail => ({
          field: `body.${detail.path.join('.')}`,
          message: detail.message,
          value: detail.context?.value
        })));
      }
    }

    // Validate query parameters
    if (schema.query) {
      const { error } = schema.query.validate(req.query, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map(detail => ({
          field: `query.${detail.path.join('.')}`,
          message: detail.message,
          value: detail.context?.value
        })));
      }
    }

    // Validate route parameters
    if (schema.params) {
      const { error } = schema.params.validate(req.params, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map(detail => ({
          field: `params.${detail.path.join('.')}`,
          message: detail.message,
          value: detail.context?.value
        })));
      }
    }

    // If validation errors exist, return error response
    if (errors.length > 0) {
      const errorResponse = createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Validation failed',
        errors
      );
      res.status(400).json(errorResponse);
      return;
    }

    // If validation passes, continue to next middleware
    next();
  };
};

/**
 * Common Joi validation schemas
 */
export const commonSchemas = {
  // UUID validation
  uuid: Joi.string().uuid().required(),
  optionalUuid: Joi.string().uuid().optional(),

  // Pagination
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10)
  }),

  // Phone number validation (international format with optional + prefix)
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),

  // Email validation
  email: Joi.string().email().optional(),

  // Password validation (strong password requirements)
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .message('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

  // OTP validation
  otp: Joi.string().length(6).pattern(/^\d{6}$/),

  // Search query
  search: Joi.string().max(255).optional(),

  // Sort parameters
  sortBy: Joi.string().optional(),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),

  // Date validation
  date: Joi.date().iso(),
  optionalDate: Joi.date().iso().optional(),

  // File upload validation
  file: Joi.object({
    filename: Joi.string().required(),
    mimetype: Joi.string().required(),
    size: Joi.number().max(10 * 1024 * 1024) // 10MB max
  })
};

/**
 * Validation schemas for common request types
 */
export const validationSchemas = {
  // Pagination query validation
  paginationQuery: {
    query: commonSchemas.pagination
  },

  // UUID parameter validation
  uuidParam: {
    params: Joi.object({
      id: commonSchemas.uuid
    })
  },

  // Search with pagination
  searchQuery: {
    query: Joi.object({
      ...commonSchemas.pagination.describe().keys,
      search: commonSchemas.search,
      sortBy: commonSchemas.sortBy,
      sortOrder: commonSchemas.sortOrder
    })
  }
};