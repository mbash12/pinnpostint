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
import { isDevMode, config } from '../config/environment';
import { OtpService, OtpType } from '../utils/otp';

// Validation schemas
const registerSchema = Joi.object({
  phone: Joi.string().required().pattern(/^[0-9]{10}$/)
});

const verifyOtpSchema = Joi.object({
  phone: Joi.string().required().pattern(/^[0-9]{10}$/),
  otp: Joi.string().required().length(6).pattern(/^\d{6}$/)
});

const completeRegistrationSchema = Joi.object({
  firstName: Joi.string().required().min(1).max(50),
  lastName: Joi.string().max(50).allow('').optional(),
  password: Joi.string().required().min(8).max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .message('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  email: Joi.string().email().optional()
});

const loginSchema = Joi.object({
  phone: Joi.string().pattern(/^[0-9]{10}$/),
  email: Joi.string().email(),
  password: Joi.string().required()
}).or('phone', 'email');

const forgotPasswordSchema = Joi.object({
  phone: Joi.string().required().pattern(/^[0-9]{10}$/)
});

/**
 * @swagger
 * components:
 *   schemas:
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - phone
 *       properties:
 *         phone:
 *           type: string
 *           pattern: '^\+[1-9]\d{1,14}$'
 *           example: '+1234567890'
 *     VerifyOtpRequest:
 *       type: object
 *       required:
 *         - phone
 *         - otp
 *       properties:
 *         phone:
 *           type: string
 *           pattern: '^\+?[1-9]\d{1,14}$'
 *           example: '+1234567890'
 *         otp:
 *           type: string
 *           pattern: '^\d{6}$'
 *           example: '123456'
 *     CompleteRegistrationRequest:
 *       type: object
 *       required:
 *         - firstName
 *         - password
 *       properties:
 *         firstName:
 *           type: string
 *           minLength: 1
 *           maxLength: 50
 *           example: 'John'
 *         lastName:
 *           type: string
 *           maxLength: 50
 *           example: 'Doe'
 *         password:
 *           type: string
 *           minLength: 8
 *           maxLength: 128
 *           example: 'SecurePass123!'
 *         email:
 *           type: string
 *           format: email
 *           example: 'john.doe@example.com'
 *     LoginRequest:
 *       type: object
 *       required:
 *         - phone
 *         - password
 *       properties:
 *         phone:
 *           type: string
 *           pattern: '^\+?[1-9]\d{1,14}$'
 *           example: '+1234567890'
 *         password:
 *           type: string
 *           example: 'SecurePass123!'
 */

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Step 1 - Request OTP for registration
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       200:
 *         description: OTP sent successfully
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
 *                   example: 'OTP sent successfully'
 *                 data:
 *                   type: object
 *                   properties:
 *                     otpId:
 *                       type: string
 *                       format: uuid
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         description: User already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: 'USER_EXISTS'
 *                 message: 'User with this phone number already exists'
 */
export const register = asyncHandler(async (
  req: Request,
  res: Response
): Promise<void> => {
  const { error, value } = registerSchema.validate(req.body);
  if (error) {
    throw ApiError.validation('Validation failed', error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    })));
  }

  const { phone } = value;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { phone }
  });

  if (existingUser) {
    throw ApiError.userExists('User with this phone number already exists');
  }

  // Create and send OTP via SMS
  const { otpRecord, sendResult } = await OtpService.createAndSendOtp(phone, {
    type: OtpType.REGISTRATION,
    channel: 'sms'
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
    sendResult.devMode ? 'OTP sent (development mode - you can use either the SMS OTP or 123456)' : 'OTP sent successfully'
  );

  res.status(200).json(response);
});

/**
 * @swagger
 * /api/v1/auth/registration/verify-otp:
 *   post:
 *     summary: Step 2 - Verify OTP for registration
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyOtpRequest'
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
 *                     tempToken:
 *                       type: string
 *                       description: 'Temporary token for completing registration'
 *       400:
 *         description: Invalid or expired OTP
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: 'INVALID_OTP'
 *                 message: 'Invalid or expired OTP'
 */
export const verifyRegistrationOtp = asyncHandler(async (
  req: Request,
  res: Response
): Promise<void> => {
  const { error, value } = verifyOtpSchema.validate(req.body);
  if (error) {
    throw ApiError.validation('Validation failed', error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    })));
  }

  const { phone, otp } = value;

  // Verify OTP using the OTP service
  const validOtp = await OtpService.verifyOtp(phone, otp, OtpType.REGISTRATION);

  // In development mode, allow TEST_OTP as a fallback when OTP doesn't exist in DB
  if (!validOtp && isDevMode() && otp === config.testing.testOtp) {
    console.log(`[DEV MODE] Using TEST_OTP for ${phone}`);
    // Generate temporary token without marking OTP as used (since it doesn't exist in DB)
    const tempToken = jwt.sign(
      {
        phone,
        type: 'temp_registration',
        testMode: true
      },
      process.env.JWT_SECRET!,
      { expiresIn: '30m' }
    );

    const response = createSuccessResponse(
      { tempToken, devMode: true },
      'OTP verified successfully (development mode)'
    );

    res.status(200).json(response);
    return;
  }

  if (!validOtp) {
    throw ApiError.invalidOtp();
  }

  // Generate temporary token for completing registration
  const tempToken = jwt.sign(
    {
      phone,
      type: 'temp_registration',
      otpId: validOtp.id
    },
    process.env.JWT_SECRET!,
    { expiresIn: '30m' }
  );

  const response = createSuccessResponse(
    { tempToken },
    'OTP verified successfully'
  );

  res.status(200).json(response);
});

/**
 * @swagger
 * /api/v1/auth/registration/complete:
 *   post:
 *     summary: Step 3 - Complete registration
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CompleteRegistrationRequest'
 *     responses:
 *       201:
 *         description: Registration completed successfully
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
 *                   example: 'Registration completed successfully'
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     token:
 *                       type: string
 *                       description: 'JWT access token'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const completeRegistration = asyncHandler(async (
  req: Request,
  res: Response
): Promise<void> => {
  const { error, value } = completeRegistrationSchema.validate(req.body);
  if (error) {
    throw ApiError.validation('Validation failed', error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    })));
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Temporary token required');
  }

  const tempToken = authHeader.substring(7);
  let decoded: any;

  try {
    decoded = jwt.verify(tempToken, process.env.JWT_SECRET!);
  } catch {
    throw ApiError.invalidToken('Invalid or expired temporary token');
  }

  if (decoded.type !== 'temp_registration') {
    throw ApiError.invalidToken('Invalid token type');
  }

  const { firstName, lastName, password, email } = value;
  const { phone } = decoded;

  // Convert empty string lastName to null for database
  const processedLastName = lastName && lastName.trim() ? lastName.trim() : null;

  // Normalize email to lowercase for case-insensitive comparison
  const normalizedEmail = email ? email.toLowerCase().trim() : null;

  // Check if user already exists (double check)
  const existingUser = await prisma.user.findUnique({
    where: { phone }
  });

  if (existingUser) {
    throw ApiError.userExists('User with this phone number already exists');
  }

  // Check if email already exists (if email is provided)
  if (normalizedEmail) {
    const existingEmail = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingEmail) {
      throw ApiError.validation('Email already in use', [{
        field: 'email',
        message: 'This email address is already registered. Please use a different email or login with your existing account.',
        value: email
      }]);
    }
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Create user with default profile
  const user = await prisma.user.create({
    data: {
      phone,
      password: hashedPassword,
      firstName,
      lastName: processedLastName,
      email: normalizedEmail,
      isVerified: true, // User is verified after OTP confirmation
      profile: {
        create: {
          emailNotifications: true,
          pushNotifications: true,
        }
      }
    },
    select: {
      id: true,
      phone: true,
      email: true,
      firstName: true,
      lastName: true,
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

  // Generate JWT token
  const token = jwt.sign(
    {
      userId: user.id,
      phone: user.phone,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Format user data according to StandardUser interface
  const standardUser: StandardUser = {
    id: user.id,
    phone: user.phone,
    email: user.email || undefined,
    firstName: user.firstName,
    lastName: user.lastName || undefined,
    role: user.role as UserRole,
    isActive: user.isActive,
    isVerified: user.isVerified,
    avatar: user.avatar || undefined,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    profile: user.profile ? {
      bio: user.profile.bio || undefined,
      address: user.profile.address || undefined,
      city: user.profile.city?.name || undefined,
      state: user.profile.state?.name || undefined,
      country: user.profile.country || undefined,
      postalCodeId: user.profile.postalCodeId || undefined,
      dob: user.profile.dob?.toISOString() || undefined,
      gender: user.profile.gender || undefined,
      emailNotifications: user.profile.emailNotifications,
      pushNotifications: user.profile.pushNotifications,
    } : undefined
  };

  const response = createSuccessResponse(
    {
      token,
      user: standardUser,
      expiresAt: expiresAt.toISOString()
    },
    'Registration completed successfully'
  );

  res.status(201).json(response);
});

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: User login (phone + password, no OTP for verified users)
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
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
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     token:
 *                       type: string
 *                       description: 'JWT access token'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/responses/UnauthorizedError'
 *             example:
 *               success: false
 *               error:
 *                 code: 'INVALID_CREDENTIALS'
 *                 message: 'Invalid phone number or password'
 */
export const login = asyncHandler(async (
  req: Request,
  res: Response
): Promise<void> => {
  const { error, value } = loginSchema.validate(req.body);
  if (error) {
    throw ApiError.validation('Validation failed', error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    })));
  }

  const { phone, email, password } = value;

  // Find user by phone or email
  const whereClause = phone ? { phone } : { email };
  const user = await prisma.user.findUnique({
    where: whereClause,
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

  if (!user) {
    const identifier = phone ? 'phone number' : 'email';
    throw ApiError.invalidCredentials(`Invalid ${identifier} or password`);
  }

  if (!user.isActive) {
    throw ApiError.accountDisabled();
  }

  if (!user.isVerified) {
    throw ApiError.accountNotVerified();
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    const identifier = phone ? 'phone number' : 'email';
    throw ApiError.invalidCredentials(`Invalid ${identifier} or password`);
  }

  // Generate JWT token
  const token = jwt.sign(
    {
      userId: user.id,
      phone: user.phone,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Format user data according to StandardUser interface
  const standardUser: StandardUser = {
    id: user.id,
    phone: user.phone,
    email: user.email || undefined,
    firstName: user.firstName,
    lastName: user.lastName || undefined,
    role: user.role as UserRole,
    isActive: user.isActive,
    isVerified: user.isVerified,
    avatar: user.avatar || undefined,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    profile: user.profile ? {
      bio: user.profile.bio || undefined,
      address: user.profile.address || undefined,
      city: user.profile.city?.name || undefined,
      state: user.profile.state?.name || undefined,
      country: user.profile.country || undefined,
      postalCodeId: user.profile.postalCodeId || undefined,
      dob: user.profile.dob?.toISOString() || undefined,
      gender: user.profile.gender || undefined,
      emailNotifications: user.profile.emailNotifications,
      pushNotifications: user.profile.pushNotifications,
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
 * /api/v1/auth/password/forgot:
 *   post:
 *     summary: Step 1 - Request OTP for password reset
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               phone:
 *                 type: string
 *                 pattern: '^\+?[1-9]\d{1,14}$'
 *                 example: '+1234567890'
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
 *                   example: 'Password reset OTP sent successfully'
 *                 data:
 *                   type: object
 *                   properties:
 *                     otpId:
 *                       type: string
 *                       format: uuid
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: 'USER_NOT_FOUND'
 *                 message: 'User with this phone number not found'
 */
export const forgotPassword = asyncHandler(async (
  req: Request,
  res: Response
): Promise<void> => {
  const { error, value } = forgotPasswordSchema.validate(req.body);
  if (error) {
    throw ApiError.validation('Validation failed', error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    })));
  }

  const { phone } = value;

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { phone },
    select: { id: true, isActive: true, isVerified: true }
  });

  if (!user) {
    throw ApiError.userNotFound('User with this phone number not found');
  }

  if (!user.isActive) {
    throw ApiError.accountDisabled();
  }

  if (!user.isVerified) {
    throw ApiError.accountNotVerified();
  }

  // Create and send OTP via SMS
  const { otpRecord, sendResult } = await OtpService.createAndSendOtp(phone, {
    type: OtpType.PASSWORD_RESET,
    channel: 'sms'
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
    sendResult.devMode ? 'Password reset OTP sent (development mode - you can use either the SMS OTP or 123456)' : 'Password reset OTP sent successfully'
  );

  res.status(200).json(response);
});

/**
 * @swagger
 * /api/v1/auth/password/verify-reset-otp:
 *   post:
 *     summary: Step 2 - Verify OTP for password reset
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyOtpRequest'
 *     responses:
 *       200:
 *         description: Password reset OTP verified successfully
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
 *                   example: 'Password reset OTP verified successfully'
 *                 data:
 *                   type: object
 *                   properties:
 *                     resetToken:
 *                       type: string
 *                       description: 'Temporary token for password reset'
 *       400:
 *         description: Invalid or expired OTP
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: 'INVALID_OTP'
 *                 message: 'Invalid or expired OTP'
 */
export const verifyResetOtp = asyncHandler(async (
  req: Request,
  res: Response
): Promise<void> => {
  const { error, value } = verifyOtpSchema.validate(req.body);
  if (error) {
    throw ApiError.validation('Validation failed', error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    })));
  }

  const { phone, otp } = value;

  // Verify OTP using the OTP service
  const validOtp = await OtpService.verifyOtp(phone, otp, OtpType.PASSWORD_RESET);

  if (!validOtp) {
    throw ApiError.invalidOtp();
  }

  // Generate temporary reset token
  const resetToken = jwt.sign(
    {
      phone,
      type: 'password_reset',
      otpId: validOtp.id
    },
    process.env.JWT_SECRET!,
    { expiresIn: '30m' }
  );

  const response = createSuccessResponse(
    { resetToken },
    'Password reset OTP verified successfully'
  );

  res.status(200).json(response);
});

/**
 * @swagger
 * /api/v1/auth/password/reset:
 *   post:
 *     summary: Step 3 - Set new password
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPassword
 *             properties:
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 maxLength: 128
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
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const resetPassword = asyncHandler(async (
  req: Request,
  res: Response
): Promise<void> => {
  const { error, value } = Joi.object({
    newPassword: Joi.string().required().min(8).max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .message('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
  }).validate(req.body);

  if (error) {
    throw ApiError.validation('Validation failed', error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    })));
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Reset token required');
  }

  const resetToken = authHeader.substring(7);
  let decoded: any;

  try {
    decoded = jwt.verify(resetToken, process.env.JWT_SECRET!);
  } catch {
    throw ApiError.invalidToken('Invalid or expired reset token');
  }

  if (decoded.type !== 'password_reset') {
    throw ApiError.invalidToken('Invalid token type');
  }

  const { newPassword } = value;
  const { phone } = decoded;

  // Find user
  const user = await prisma.user.findUnique({
    where: { phone },
    select: { id: true, isActive: true, isVerified: true }
  });

  if (!user) {
    throw ApiError.userNotFound();
  }

  if (!user.isActive) {
    throw ApiError.accountDisabled();
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 12);

  // Update user password
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword }
  });

  const response = createSuccessResponse(
    null,
    'Password reset successfully'
  );

  res.status(200).json(response);
});
