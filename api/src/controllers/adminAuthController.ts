import { Request, Response } from 'express';
import { prisma } from '../utils/database';
import Joi from 'joi';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {
  createSuccessResponse,
  StandardUser,
  UserRole
} from '../types/api-responses';
import { ApiError, asyncHandler } from '../utils/errors';
import { OtpService, OtpType } from '../utils/otp';

// Validation schemas
const adminForgotPasswordSchema = Joi.object({
  email: Joi.string().email().required()
});

const adminVerifyResetOtpSchema = Joi.object({
  email: Joi.string().email().required(),
  otp: Joi.string().required().length(6).pattern(/^\d{6}$/)
});

const adminResetPasswordSchema = Joi.object({
  resetToken: Joi.string().required(),
  newPassword: Joi.string().required().min(6).max(128)
    .pattern(/^[a-zA-Z0-9]{6,}$/)
    .message('Password must contain at least 6 alphanumeric characters')
});

const adminLoginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required().min(6)
});

const updateProfileSchema = Joi.object({
  firstName: Joi.string().min(1).max(50).optional(),
  lastName: Joi.string().max(50).optional(),
  email: Joi.string().email().optional(),
  avatar: Joi.string().uri().optional()
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().min(6),
  newPassword: Joi.string().required().min(6).max(128)
    .pattern(/^[a-zA-Z0-9]{6,}$/)
    .message('Password must contain at least 6 alphanumeric characters'),
  confirmPassword: Joi.string().required().valid(Joi.ref('newPassword'))
    .messages({
      'any.only': 'Passwords do not match'
    })
});


/**
 * @swagger
 * /api/v1/auth/admin/login:
 *   post:
 *     summary: Admin login
 *     tags: [Admin Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: 'admin@example.com'
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: 'SecurePass123!'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'Login successful'
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         description: Invalid credentials
 */
export const adminLogin = asyncHandler(async (
  req: Request,
  res: Response
): Promise<void> => {
  const { error, value } = adminLoginSchema.validate(req.body);
  if (error) {
    throw ApiError.validation('Validation failed', error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    })));
  }

  const { email, password } = value;

  // Find admin user
  const admin = await prisma.user.findUnique({
    where: { 
      email,
      role: 'ADMIN'
    },
    select: {
      id: true,
      phone: true,
      email: true,
      firstName: true,
      lastName: true,
      password: true,
      role: true,
      isActive: true,
      isVerified: true,
      avatar: true,
      createdAt: true,
      updatedAt: true,
      profile: {
        select: {
          bio: true,
          address: true,
          city: {
            select: { name: true }
          },
          state: {
            select: { name: true }
          },
          country: true,
          postalCodeId: true,
          dob: true,
          gender: true,
          emailNotifications: true,
          pushNotifications: true,
        }
      }
    }
  });

  if (!admin) {
    throw ApiError.invalidCredentials('Invalid email or password');
  }

  if (!admin.isActive) {
    throw ApiError.accountDisabled();
  }

  if (!admin.isVerified) {
    throw ApiError.accountNotVerified();
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, admin.password);
  if (!isPasswordValid) {
    throw ApiError.invalidCredentials('Invalid email or password');
  }

  // Generate JWT token
  const token = jwt.sign(
    { 
      userId: admin.id,
      phone: admin.phone,
      email: admin.email,
      role: admin.role
    },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Format user data according to StandardUser interface
  const standardUser: StandardUser = {
    id: admin.id,
    phone: admin.phone,
    email: admin.email || undefined,
    firstName: admin.firstName,
    lastName: admin.lastName || undefined,
    role: admin.role as UserRole,
    isActive: admin.isActive,
    isVerified: admin.isVerified,
    avatar: admin.avatar || undefined,
    createdAt: admin.createdAt.toISOString(),
    updatedAt: admin.updatedAt.toISOString(),
    profile: admin.profile ? {
      bio: admin.profile.bio || undefined,
      address: admin.profile.address || undefined,
      city: admin.profile.city?.name || undefined,
      state: admin.profile.state?.name || undefined,
      country: admin.profile.country || undefined,
      postalCodeId: admin.profile.postalCodeId || undefined,
      dob: admin.profile.dob?.toISOString() || undefined,
      gender: admin.profile.gender || undefined,
      emailNotifications: admin.profile.emailNotifications,
      pushNotifications: admin.profile.pushNotifications,
    } : undefined
  };

  const response = createSuccessResponse(
    {
      token,
      user: standardUser,
      expiresAt: expiresAt.toISOString()
    },
    'Login successful'
  );

  res.status(200).json(response);
});

/**
 * @swagger
 * /api/v1/auth/admin/password/forgot:
 *   post:
 *     summary: Request admin password reset
 *     tags: [Admin Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: 'admin@example.com'
 *     responses:
 *       200:
 *         description: Password reset OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'Password reset OTP sent to your email'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Admin not found
 */
export const adminForgotPassword = asyncHandler(async (
  req: Request,
  res: Response
): Promise<void> => {
  const { error, value } = adminForgotPasswordSchema.validate(req.body);
  if (error) {
    throw ApiError.validation('Validation failed', error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    })));
  }

  const { email } = value;

  // Check if admin user exists
  const admin = await prisma.user.findUnique({
    where: {
      email,
      role: 'ADMIN'
    },
    select: {
      id: true,
      email: true,
      isActive: true,
      isVerified: true
    }
  });

  if (!admin) {
    throw ApiError.userNotFound('Admin with this email not found');
  }

  if (!admin.isActive) {
    throw ApiError.accountDisabled();
  }

  if (!admin.isVerified) {
    throw ApiError.accountNotVerified();
  }

  // Create and send OTP via email
  const { otpRecord, sendResult } = await OtpService.createAndSendOtp(email, {
    type: OtpType.ADMIN_PASSWORD_RESET,
    channel: 'email'
  });

  // Prepare response data
  const responseData: any = {
    otpId: otpRecord.id,
    expiresAt: otpRecord.expiresAt.toISOString()
  };

  // In development mode, include the OTP in the response
  if (sendResult.devMode && sendResult.otp) {
    responseData.otp = sendResult.otp;
    responseData.devMode = true;
  }

  const response = createSuccessResponse(
    responseData,
    sendResult.devMode ? 'Password reset OTP sent (development mode - you can use either the email OTP or 123456)' : 'Password reset OTP sent to your email'
  );

  res.status(200).json(response);
});

/**
 * @swagger
 * /api/v1/auth/admin/password/verify-reset-otp:
 *   post:
 *     summary: Verify admin password reset OTP
 *     tags: [Admin Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: 'admin@example.com'
 *               otp:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 6
 *                 example: '123456'
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'OTP verified successfully'
 *                 data:
 *                   type: object
 *                   properties:
 *                     resetToken:
 *                       type: string
 *       400:
 *         description: Invalid or expired OTP
 */
export const adminVerifyResetOtp = asyncHandler(async (
  req: Request,
  res: Response
): Promise<void> => {
  const { error, value } = adminVerifyResetOtpSchema.validate(req.body);
  if (error) {
    throw ApiError.validation('Validation failed', error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    })));
  }

  const { email, otp } = value;

  // Verify OTP using the OTP service
  const validOtp = await OtpService.verifyOtp(email, otp, OtpType.ADMIN_PASSWORD_RESET);

  if (!validOtp) {
    throw ApiError.invalidOtp();
  }

  // Generate temporary reset token
  const resetToken = jwt.sign(
    {
      email,
      type: 'admin_password_reset',
      otpId: validOtp.id
    },
    process.env.JWT_SECRET!,
    { expiresIn: '30m' }
  );

  const response = createSuccessResponse(
    { resetToken },
    'OTP verified successfully'
  );

  res.status(200).json(response);
});

/**
 * @swagger
 * /api/v1/auth/admin/password/reset:
 *   post:
 *     summary: Reset admin password
 *     tags: [Admin Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - resetToken
 *               - newPassword
 *             properties:
 *               resetToken:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 example: 'NewSecurePass123!'
 *     responses:
 *       200:
 *         description: Password reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'Password reset successfully'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Invalid or expired reset token
 */
export const adminResetPassword = asyncHandler(async (
  req: Request,
  res: Response
): Promise<void> => {
  const { error, value } = adminResetPasswordSchema.validate(req.body);
  if (error) {
    throw ApiError.validation('Validation failed', error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    })));
  }

  const { resetToken, newPassword } = value;
  let decoded: jwt.JwtPayload;

  try {
    decoded = jwt.verify(resetToken, process.env.JWT_SECRET!) as jwt.JwtPayload;
  } catch {
    throw ApiError.invalidToken('Invalid or expired reset token');
  }

  if (decoded.type !== 'admin_password_reset') {
    throw ApiError.invalidToken('Invalid token type');
  }

  const { email } = decoded;

  // Find admin user
  const admin = await prisma.user.findUnique({
    where: { 
      email,
      role: 'ADMIN'
    },
    select: { 
      id: true, 
      isActive: true, 
      isVerified: true 
    }
  });

  if (!admin) {
    throw ApiError.userNotFound('Admin not found');
  }

  if (!admin.isActive) {
    throw ApiError.accountDisabled();
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 12);

  // Update admin password
  await prisma.user.update({
    where: { id: admin.id },
    data: { password: hashedPassword }
  });

  const response = createSuccessResponse(
    null,
    'Password reset successfully'
  );

  res.status(200).json(response);
});

/**
 * @swagger
 * /api/v1/admin/profile:
 *   get:
 *     summary: Get current admin profile
 *     tags: [Admin Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 */
export const getAdminProfile = asyncHandler(async (
  req: Request,
  res: Response
): Promise<void> => {
  // Get user ID from auth middleware (assumes auth middleware sets req.user)
  const userId = (req as any).user?.id;

  if (!userId) {
    throw ApiError.unauthorized('Authentication required');
  }

  // Find admin user
  const admin = await prisma.user.findUnique({
    where: {
      id: userId,
      role: 'ADMIN'
    },
    select: {
      id: true,
      phone: true,
      email: true,
      firstName: true,
      lastName: true,
      avatar: true,
      role: true,
      isActive: true,
      isVerified: true,
      createdAt: true,
      updatedAt: true,
      profile: {
        select: {
          bio: true,
          address: true,
          city: {
            select: { name: true }
          },
          state: {
            select: { name: true }
          },
          country: true,
          postalCodeId: true,
          dob: true,
          gender: true,
          emailNotifications: true,
          pushNotifications: true,
        }
      }
    }
  });

  if (!admin) {
    // Check if the user exists but doesn't have the admin role
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (userExists) {
      // User exists but doesn't have admin role anymore
      throw ApiError.forbidden('Access denied. User role has changed and no longer has admin privileges.');
    } else {
      // User doesn't exist at all
      throw ApiError.userNotFound('Admin not found');
    }
  }

  // Format user data according to StandardUser interface
  const standardUser: StandardUser = {
    id: admin.id,
    phone: admin.phone,
    email: admin.email || undefined,
    firstName: admin.firstName,
    lastName: admin.lastName || undefined,
    role: admin.role as UserRole,
    isActive: admin.isActive,
    isVerified: admin.isVerified,
    avatar: admin.avatar || undefined,
    createdAt: admin.createdAt.toISOString(),
    updatedAt: admin.updatedAt.toISOString(),
    profile: admin.profile ? {
      bio: admin.profile.bio || undefined,
      address: admin.profile.address || undefined,
      city: admin.profile.city?.name || undefined,
      state: admin.profile.state?.name || undefined,
      country: admin.profile.country || undefined,
      postalCodeId: admin.profile.postalCodeId || undefined,
      dob: admin.profile.dob?.toISOString() || undefined,
      gender: admin.profile.gender || undefined,
      emailNotifications: admin.profile.emailNotifications,
      pushNotifications: admin.profile.pushNotifications,
    } : undefined
  };

  const response = createSuccessResponse(standardUser);
  res.status(200).json(response);
});

/**
 * @swagger
 * /api/v1/admin/profile:
 *   put:
 *     summary: Update current admin profile
 *     tags: [Admin Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 50
 *                 example: 'John'
 *               lastName:
 *                 type: string
 *                 maxLength: 50
 *                 example: 'Doe'
 *               email:
 *                 type: string
 *                 format: email
 *                 example: 'john.doe@example.com'
 *               avatar:
 *                 type: string
 *                 format: uri
 *                 example: 'http://localhost:3001/uploads/images/avatar-123456789.jpg'
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'Profile updated successfully'
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
export const updateAdminProfile = asyncHandler(async (
  req: Request,
  res: Response
): Promise<void> => {
  const { error, value } = updateProfileSchema.validate(req.body);
  if (error) {
    throw ApiError.validation('Validation failed', error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    })));
  }

  // Get user ID from auth middleware
  const userId = (req as any).user?.id;

  if (!userId) {
    throw ApiError.unauthorized('Authentication required');
  }

  // Check if admin exists
  const existingAdmin = await prisma.user.findUnique({
    where: { 
      id: userId,
      role: 'ADMIN'
    }
  });

  if (!existingAdmin) {
    throw ApiError.userNotFound('Admin not found');
  }

  // Check if email is being updated and if it's already taken
  if (value.email && value.email !== existingAdmin.email) {
    const emailExists = await prisma.user.findUnique({
      where: { email: value.email }
    });

    if (emailExists) {
      throw ApiError.conflict('Email is already taken');
    }
  }

  // Update admin profile
  const updatedAdmin = await prisma.user.update({
    where: { id: userId },
    data: {
      ...value,
      updatedAt: new Date()
    },
    select: {
      id: true,
      phone: true,
      email: true,
      firstName: true,
      lastName: true,
      avatar: true,
      role: true,
      isActive: true,
      isVerified: true,
      createdAt: true,
      updatedAt: true
    }
  });

  const response = createSuccessResponse(
    updatedAdmin,
    'Profile updated successfully'
  );

  res.status(200).json(response);
});

/**
 * @swagger
 * /api/v1/admin/change-password:
 *   put:
 *     summary: Change admin password
 *     tags: [Admin Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *               - confirmPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 minLength: 6
 *                 example: 'OldPassword123!'
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 maxLength: 128
 *                 example: 'NewPassword123!'
 *                 description: Must contain uppercase, lowercase, number, and special character
 *               confirmPassword:
 *                 type: string
 *                 example: 'NewPassword123!'
 *                 description: Must match newPassword
 *     responses:
 *       200:
 *         description: Password changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'Password changed successfully'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Current password is incorrect
 */
export const changePassword = asyncHandler(async (
  req: Request,
  res: Response
): Promise<void> => {
  const { error, value } = changePasswordSchema.validate(req.body);
  if (error) {
    throw ApiError.validation('Validation failed', error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    })));
  }

  // Get user ID from auth middleware
  const userId = (req as any).user?.id;

  if (!userId) {
    throw ApiError.unauthorized('Authentication required');
  }

  // Find the admin user
  const admin = await prisma.user.findUnique({
    where: { 
      id: userId,
      role: 'ADMIN'
    }
  });

  if (!admin) {
    throw ApiError.userNotFound('Admin not found');
  }

  // Verify current password
  const isPasswordValid = await bcrypt.compare(value.currentPassword, admin.password);
  if (!isPasswordValid) {
    throw ApiError.invalidCurrentPassword('Current password is incorrect');
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(value.newPassword, 10);

  // Update password
  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword,
      updatedAt: new Date()
    }
  });

  const response = createSuccessResponse(
    null,
    'Password changed successfully'
  );

  res.status(200).json(response);
});
