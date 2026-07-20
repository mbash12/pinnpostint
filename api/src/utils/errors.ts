import { Request, Response, NextFunction } from 'express';
import { ErrorCode, ValidationError } from '../types/api-responses';

/**
 * Custom API Error class for consistent error handling
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: ValidationError[];

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    details?: ValidationError[]
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = 'ApiError';

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  /**
   * Create a validation error
   */
  static validation(message: string, details?: ValidationError[]): ApiError {
    return new ApiError(400, ErrorCode.VALIDATION_ERROR, message, details);
  }

  /**
   * Create an unauthorized error
   */
  static unauthorized(message: string = 'Unauthorized'): ApiError {
    return new ApiError(401, ErrorCode.UNAUTHORIZED, message);
  }

  /**
   * Create a forbidden error
   */
  static forbidden(message: string = 'Forbidden'): ApiError {
    return new ApiError(403, ErrorCode.FORBIDDEN, message);
  }

  /**
   * Create a not found error
   */
  static notFound(message: string = 'Resource not found'): ApiError {
    return new ApiError(404, ErrorCode.NOT_FOUND, message);
  }

  /**
   * Create a conflict error
   */
  static conflict(message: string = 'Conflict'): ApiError {
    return new ApiError(409, ErrorCode.CONFLICT, message);
  }

  /**
   * Create an internal server error
   */
  static internal(message: string = 'Internal server error'): ApiError {
    return new ApiError(500, ErrorCode.INTERNAL_SERVER_ERROR, message);
  }

  /**
   * Create a rate limit exceeded error
   */
  static rateLimitExceeded(message: string = 'Rate limit exceeded'): ApiError {
    return new ApiError(429, ErrorCode.RATE_LIMIT_EXCEEDED, message);
  }

  /**
   * Create an invalid credentials error
   */
  static invalidCredentials(message: string = 'Invalid credentials'): ApiError {
    return new ApiError(401, ErrorCode.INVALID_CREDENTIALS, message);
  }

  /**
   * Create an invalid current password error (for password changes)
   * Returns 400 instead of 401 to avoid triggering automatic logout
   */
  static invalidCurrentPassword(message: string = 'Current password is incorrect'): ApiError {
    return new ApiError(400, ErrorCode.INVALID_CREDENTIALS, message);
  }

  /**
   * Create an invalid token error
   */
  static invalidToken(message: string = 'Invalid token'): ApiError {
    return new ApiError(401, ErrorCode.INVALID_TOKEN, message);
  }

  /**
   * Create a token expired error
   */
  static tokenExpired(message: string = 'Token expired'): ApiError {
    return new ApiError(401, ErrorCode.TOKEN_EXPIRED, message);
  }

  /**
   * Create an account disabled error
   */
  static accountDisabled(message: string = 'Account is disabled'): ApiError {
    return new ApiError(401, ErrorCode.ACCOUNT_DISABLED, message);
  }

  /**
   * Create an account not verified error
   */
  static accountNotVerified(message: string = 'Account is not verified'): ApiError {
    return new ApiError(401, ErrorCode.ACCOUNT_NOT_VERIFIED, message);
  }

  /**
   * Create a user exists error
   */
  static userExists(message: string = 'User already exists'): ApiError {
    return new ApiError(409, ErrorCode.USER_EXISTS, message);
  }

  /**
   * Create a user not found error
   */
  static userNotFound(message: string = 'User not found'): ApiError {
    return new ApiError(404, ErrorCode.USER_NOT_FOUND, message);
  }

  /**
   * Create an invalid OTP error
   */
  static invalidOtp(message: string = 'Invalid or expired OTP'): ApiError {
    return new ApiError(400, ErrorCode.INVALID_OTP, message);
  }

  /**
   * Create a file upload error
   */
  static uploadFailed(message: string = 'File upload failed'): ApiError {
    return new ApiError(400, ErrorCode.UPLOAD_FAILED, message);
  }

  /**
   * Create a file too large error
   */
  static fileTooLarge(message: string = 'File size exceeds limit'): ApiError {
    return new ApiError(400, ErrorCode.FILE_TOO_LARGE, message);
  }

  /**
   * Create an invalid file type error
   */
  static invalidFileType(message: string = 'Invalid file type'): ApiError {
    return new ApiError(400, ErrorCode.INVALID_FILE_TYPE, message);
  }

  /**
   * Create a resource-specific not found error
   */
  static adNotFound(message: string = 'Ad not found'): ApiError {
    return new ApiError(404, ErrorCode.AD_NOT_FOUND, message);
  }

  static categoryNotFound(message: string = 'Category not found'): ApiError {
    return new ApiError(404, ErrorCode.CATEGORY_NOT_FOUND, message);
  }

  static subcategoryNotFound(message: string = 'Subcategory not found'): ApiError {
    return new ApiError(404, ErrorCode.SUBCATEGORY_NOT_FOUND, message);
  }

  static locationNotFound(message: string = 'Location not found'): ApiError {
    return new ApiError(404, ErrorCode.LOCATION_NOT_FOUND, message);
  }
}

/**
 * Async error handler wrapper for route handlers
 * Catches async errors and passes them to the error middleware
 */
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Error response helper functions
 */
export const errorHelpers = {
  /**
   * Handle Prisma errors and convert to ApiError
   */
  handlePrismaError: (error: { code?: string }): ApiError => {
    if (error.code === 'P2002') {
      return ApiError.conflict('Unique constraint violation');
    }
    if (error.code === 'P2025') {
      return ApiError.notFound('Record not found');
    }
    if (error.code === 'P2003') {
      return ApiError.validation('Foreign key constraint violation');
    }
    if (error.code === 'P2014') {
      return ApiError.validation('Invalid ID provided');
    }
    return ApiError.internal('Database error occurred');
  },

  /**
   * Handle JWT errors and convert to ApiError
   */
  handleJwtError: (error: { name?: string }): ApiError => {
    if (error.name === 'JsonWebTokenError') {
      return ApiError.invalidToken();
    }
    if (error.name === 'TokenExpiredError') {
      return ApiError.tokenExpired();
    }
    return ApiError.unauthorized('Authentication failed');
  },

  /**
   * Handle validation errors from Joi
   */
  handleJoiError: (error: {
    details?: Array<{
      path: (string | number)[];
      message: string;
      context?: { value?: unknown };
    }>;
  }): ApiError => {
    const details = error.details?.map(detail => ({
      field: detail.path.map(String).join('.'),
      message: detail.message,
      value: detail.context?.value,
    }));
    return ApiError.validation('Validation failed', details);
  },
};