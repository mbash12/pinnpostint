import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/database';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    email?: string;
    phone: string;
  };
}

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // For testing purposes, accept mock tokens
    if (process.env.NODE_ENV === 'test' && token === 'mock-admin-token') {
      req.user = {
        id: 'mock-admin-id',
        role: 'ADMIN',
        email: 'admin@test.com',
        phone: '+1234567890'
      };
      next();
      return;
    }

    if (process.env.NODE_ENV === 'test' && token === 'mock-user-token') {
      req.user = {
        id: 'mock-user-id',
        role: 'USER',
        email: 'user@test.com',
        phone: '+1234567891'
      };
      next();
      return;
    }

    if (process.env.NODE_ENV === 'test' && token === 'mock-user2-token') {
      req.user = {
        id: 'mock-user2-id',
        role: 'USER',
        email: 'user2@test.com',
        phone: '+1234567892'
      };
      next();
      return;
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET not configured');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        role: true,
        email: true,
        phone: true,
        isActive: true,
        isVerified: true
      }
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'User not found'
        }
      });
      return;
    }

    if (!user.isActive) {
      res.status(401).json({
        success: false,
        error: {
          code: 'ACCOUNT_DISABLED',
          message: 'Account is disabled'
        }
      });
      return;
    }

    req.user = {
      id: user.id,
      role: user.role,
      email: user.email || undefined,
      phone: user.phone
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid token'
        }
      });
      return;
    }

    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token expired'
        }
      });
      return;
    }

    next(error);
  }
};

/**
 * Admin authorization middleware
 * Requires user to be authenticated and have ADMIN role
 */
export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      }
    });
    return;
  }

  if (req.user.role !== 'ADMIN') {
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Admin access required'
      }
    });
    return;
  }

  next();
};

/**
 * Combined middleware for admin routes
 */
export const adminAuth = [authenticate, requireAdmin];

/**
 * Optional authentication middleware
 * Attaches user to request if token is valid, but doesn't fail if no token
 */
export const optionalAuthenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.substring(7);
    
    if (!process.env.JWT_SECRET) {
      next();
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        role: true,
        email: true,
        phone: true,
        isActive: true,
        isVerified: true
      }
    });

    if (user && user.isActive) {
      req.user = {
        id: user.id,
        role: user.role,
        email: user.email || undefined,
        phone: user.phone
      };
    }

    next();
  } catch (error) {
    next();
  }
};

export default { authenticate, requireAdmin, adminAuth, optionalAuthenticate };