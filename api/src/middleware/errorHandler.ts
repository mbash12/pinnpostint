import { Request, Response, NextFunction } from 'express';
import { ErrorCode, ValidationError, createErrorResponse } from '../types/api-responses';

interface CustomError extends Error {
  statusCode?: number;
  code?: string | number;
  details?: ValidationError[];
  errors?: any;
}

/**
 * Centralized error handling middleware
 * Converts various error types into standardized API error responses
 */
export const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log error for debugging (in production, use proper logging service)
  if (process.env.NODE_ENV !== 'test') {
    console.error('Error occurred:', {
      message: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      timestamp: new Date().toISOString()
    });
  }

  let statusCode = 500;
  let errorCode = ErrorCode.INTERNAL_SERVER_ERROR;
  let message = 'Internal server error';
  let details: ValidationError[] | undefined;

  // Handle different error types
  if (err.name === 'CastError') {
    // MongoDB/Mongoose bad ObjectId
    statusCode = 404;
    errorCode = ErrorCode.RESOURCE_NOT_FOUND;
    message = 'Resource not found';
  } else if (err.code === 11000 || (typeof err.code === 'number' && err.code === 11000)) {
    // MongoDB duplicate key error
    statusCode = 400;
    errorCode = ErrorCode.DUPLICATE_FIELD;
    message = 'Duplicate field value entered';
  } else if (err.name === 'ValidationError') {
    // Mongoose validation error
    statusCode = 400;
    errorCode = ErrorCode.VALIDATION_ERROR;
    message = 'Validation failed';
    details = Object.values(err.errors || {}).map((val: any) => ({
      field: val.path,
      message: val.message,
      value: val.value
    }));
  } else if (err.name === 'JsonWebTokenError') {
    // JWT invalid token
    statusCode = 401;
    errorCode = ErrorCode.INVALID_TOKEN;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    // JWT expired token
    statusCode = 401;
    errorCode = ErrorCode.TOKEN_EXPIRED;
    message = 'Token expired';
  } else if (err.code === 'P2002') {
    // Prisma unique constraint violation
    statusCode = 400;
    errorCode = ErrorCode.UNIQUE_CONSTRAINT_VIOLATION;
    message = 'A record with this value already exists';
  } else if (err.code === 'P2025') {
    // Prisma record not found
    statusCode = 404;
    errorCode = ErrorCode.NOT_FOUND;
    message = 'Record not found';
  } else if (err.code === 'P2003') {
    // Prisma foreign key constraint violation
    statusCode = 400;
    errorCode = ErrorCode.VALIDATION_ERROR;
    message = 'Cannot delete this item because it is being used by other records';
  } else if (err.code === 'P2014') {
    // Prisma invalid ID
    statusCode = 400;
    errorCode = ErrorCode.VALIDATION_ERROR;
    message = 'Invalid ID format provided';
  } else if (err.statusCode) {
    // Custom error with status code
    statusCode = err.statusCode;
    if (typeof err.code === 'string' && Object.values(ErrorCode).includes(err.code as ErrorCode)) {
      errorCode = err.code as ErrorCode;
    }
    message = err.message;
    details = err.details;
  } else if (err.message) {
    // Generic error with message
    message = err.message;
  }

  // Create standardized error response
  const errorResponse = createErrorResponse(errorCode, message, details);

  // Add stack trace in development environment
  if (process.env.NODE_ENV === 'development' && err.stack) {
    errorResponse.error.stack = err.stack;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

export default errorHandler;