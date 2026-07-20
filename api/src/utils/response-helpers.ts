import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { 
  createSuccessResponse, 
  createErrorResponse, 
  createPaginatedResponse,
  calculatePagination,
  ErrorCode,
  PaginationMeta,
  ValidationError,
  StandardUser,
  UserRole,
  UserProfile
} from '../types/api-responses';

// Re-export the response creation functions for direct use
export { createSuccessResponse, createErrorResponse, createPaginatedResponse, ErrorCode } from '../types/api-responses';

/**
 * Response helper utilities for controllers
 */
export class ResponseHelper {
  /**
   * Send a success response
   */
  static success<T>(res: Response, data: T, message?: string, statusCode: number = 200): void {
    const response = createSuccessResponse(data, message);
    res.status(statusCode).json(response);
  }

  /**
   * Send a created response (201)
   */
  static created<T>(res: Response, data: T, message?: string): void {
    ResponseHelper.success(res, data, message, 201);
  }

  /**
   * Send a no content response (204)
   */
  static noContent(res: Response): void {
    res.status(204).send();
  }

  /**
   * Send a paginated response
   */
  static paginated<T>(
    res: Response, 
    data: T[], 
    page: number, 
    limit: number, 
    total: number, 
    message?: string
  ): void {
    const pagination = calculatePagination(page, limit, total);
    const response = createPaginatedResponse(data, pagination, message);
    res.status(200).json(response);
  }

  /**
   * Send an error response
   */
  static error(
    res: Response, 
    statusCode: number, 
    code: ErrorCode, 
    message: string, 
    details?: ValidationError[]
  ): void {
    const response = createErrorResponse(code, message, details);
    res.status(statusCode).json(response);
  }

  /**
   * Send a validation error response (400)
   */
  static validationError(res: Response, message: string, details?: ValidationError[]): void {
    ResponseHelper.error(res, 400, ErrorCode.VALIDATION_ERROR, message, details);
  }

  /**
   * Send an unauthorized error response (401)
   */
  static unauthorized(res: Response, message: string = 'Unauthorized'): void {
    ResponseHelper.error(res, 401, ErrorCode.UNAUTHORIZED, message);
  }

  /**
   * Send a forbidden error response (403)
   */
  static forbidden(res: Response, message: string = 'Forbidden'): void {
    ResponseHelper.error(res, 403, ErrorCode.FORBIDDEN, message);
  }

  /**
   * Send a not found error response (404)
   */
  static notFound(res: Response, message: string = 'Resource not found'): void {
    ResponseHelper.error(res, 404, ErrorCode.NOT_FOUND, message);
  }

  /**
   * Send a conflict error response (409)
   */
  static conflict(res: Response, message: string = 'Conflict'): void {
    ResponseHelper.error(res, 409, ErrorCode.CONFLICT, message);
  }

  /**
   * Send an internal server error response (500)
   */
  static internalError(res: Response, message: string = 'Internal server error'): void {
    ResponseHelper.error(res, 500, ErrorCode.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * Pagination helper functions
 */
export class PaginationHelper {
  /**
   * Calculate skip value for database queries
   */
  static calculateSkip(page: number, limit: number): number {
    return (page - 1) * limit;
  }

  /**
   * Validate pagination parameters
   */
  static validatePagination(page?: number, limit?: number): { page: number; limit: number } {
    const validatedPage = Math.max(1, page || 1);
    const validatedLimit = Math.min(100, Math.max(1, limit || 10));
    
    return {
      page: validatedPage,
      limit: validatedLimit
    };
  }

  /**
   * Create pagination metadata from database results
   */
  static createMeta(page: number, limit: number, total: number): PaginationMeta {
    return calculatePagination(page, limit, total);
  }
}

/**
 * Data transformation helpers
 */
export class DataTransformer {
  /**
   * Transform Prisma date fields to ISO strings
   */
  static transformDates<T extends Record<string, unknown>>(obj: T): T {
    const transformed = { ...obj };
    
    for (const key in transformed) {
      const value = transformed[key] as unknown;
      if (value instanceof Date) {
        (transformed as Record<string, unknown>)[key] = value.toISOString();
      } else if (typeof value === 'object' && value !== null) {
        (transformed as Record<string, unknown>)[key] = DataTransformer.transformDates(value as Record<string, unknown>);
      }
    }
    
    return transformed;
  }

  /**
   * Remove null/undefined fields from object
   */
  static removeNullFields<T extends Record<string, unknown>>(obj: T): Partial<T> {
    const cleaned: Partial<T> = {};
    
    for (const key in obj) {
      if (obj[key] !== null && obj[key] !== undefined) {
        cleaned[key] = obj[key];
      }
    }
    
    return cleaned;
  }

  /**
   * Transform user data to StandardUser format
   */
  static transformUser(user: { id: string; phone: string; email?: string | null; firstName: string; lastName?: string | null; role: 'USER' | 'ADMIN' | 'SUPER_ADMIN'; isActive: boolean; isVerified: boolean; avatar?: string | null; createdAt: Date | string; updatedAt: Date | string; profile?: Record<string, unknown> | null }): StandardUser {
    return {
      id: user.id,
      phone: user.phone,
      email: user.email || undefined,
      firstName: user.firstName,
      lastName: user.lastName || undefined,
      role: user.role as UserRole,
      isActive: user.isActive,
      isVerified: user.isVerified,
      avatar: user.avatar || undefined,
      createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
      updatedAt: user.updatedAt instanceof Date ? user.updatedAt.toISOString() : user.updatedAt,
      profile: user.profile ? DataTransformer.transformDates(user.profile) as unknown as UserProfile : undefined
    };
  }
}

/**
 * Query helper functions
 */
export class QueryHelper {
  /**
   * Build search where clause for Prisma
   */
  static buildSearchWhere(search: string, fields: string[]): Prisma.Enumerable<Prisma.UserWhereInput | Prisma.AdWhereInput> {
    if (!search || fields.length === 0) return {};
    
    return {
      OR: fields.map(field => ({
        [field]: {
          contains: search,
          mode: 'insensitive' as const
        }
      }))
    };
  }

  /**
   * Build filter where clause
   */
  static buildFilterWhere(filters: Record<string, unknown>): Record<string, unknown> {
    const where: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        where[key] = value;
      }
    }
    
    return where;
  }

  /**
   * Combine multiple where clauses
   */
  static combineWhere(...whereClauses: Record<string, unknown>[]): Record<string, unknown> {
    const combined: Record<string, unknown> = {};
    
    for (const where of whereClauses) {
      if (where && typeof where === 'object') {
        Object.assign(combined, where);
      }
    }
    
    return combined;
  }
}

/**
 * Export all helpers as a single object for convenience
 */
export const helpers = {
  response: ResponseHelper,
  pagination: PaginationHelper,
  data: DataTransformer,
  query: QueryHelper
};
