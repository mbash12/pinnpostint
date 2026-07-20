import { Request, Response } from 'express';
import Joi from 'joi';
import { ApiError, asyncHandler } from '../utils/errors';
import { createSuccessResponse } from '../types/api-responses';
import { OtpService, OtpType } from '../utils/otp';

// Validation schemas
const requestOtpSchema = Joi.object({
  identifier: Joi.string().required(), // Can be email or phone
  type: Joi.string().valid(...Object.values(OtpType)).required(),
  channel: Joi.string().valid('email', 'sms').optional()
});

const verifyOtpSchema = Joi.object({
  identifier: Joi.string().required(), // Can be email or phone
  otp: Joi.string().required().length(6).pattern(/^\d{6}$/),
  type: Joi.string().valid(...Object.values(OtpType)).required()
});

/**
 * @swagger
 * /api/v1/otp/request:
 *   post:
 *     summary: Request OTP for various purposes
 *     tags: [OTP]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - identifier
 *               - type
 *             properties:
 *               identifier:
 *                 type: string
 *                 description: Email or phone number
 *                 example: "user@example.com or +1234567890"
 *               type:
 *                 type: string
 *                 enum: [registration, password_reset, admin_password_reset, email_verification, phone_verification, login]
 *                 example: "registration"
 *               channel:
 *                 type: string
 *                 enum: [email, sms]
 *                 example: "email"
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
 */
export const requestOtp = asyncHandler(async (
  req: Request,
  res: Response
): Promise<void> => {
  const { error, value } = requestOtpSchema.validate(req.body);
  if (error) {
    throw ApiError.validation('Validation failed', error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    })));
  }

  const { identifier, type, channel } = value;

  // Determine channel based on identifier if not specified
  const effectiveChannel = channel || (identifier.includes('@') ? 'email' : 'sms');

  // Create and send OTP
  const { otpRecord, sendResult } = await OtpService.createAndSendOtp(identifier, {
    type,
    channel: effectiveChannel
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
 * /api/v1/otp/verify:
 *   post:
 *     summary: Verify OTP
 *     tags: [OTP]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - identifier
 *               - otp
 *               - type
 *             properties:
 *               identifier:
 *                 type: string
 *                 description: Email or phone number
 *                 example: "user@example.com or +1234567890"
 *               otp:
 *                 type: string
 *                 pattern: "^\\d{6}$"
 *                 example: "123456"
 *               type:
 *                 type: string
 *                 enum: [registration, password_reset, admin_password_reset, email_verification, phone_verification, login]
 *                 example: "registration"
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
 *                     verified: boolean
 *                     otpId: string
 */
export const verifyOtp = asyncHandler(async (
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

  const { identifier, otp, type } = value;

  // Verify OTP using the OTP service
  const validOtp = await OtpService.verifyOtp(identifier, otp, type as OtpType);

  if (!validOtp) {
    throw ApiError.invalidOtp();
  }

  const response = createSuccessResponse(
    {
      verified: true,
      otpId: validOtp.id
    },
    'OTP verified successfully'
  );

  res.status(200).json(response);
});

/**
 * @swagger
 * /api/v1/otp/cleanup:
 *   post:
 *     summary: Cleanup expired OTPs (admin only)
 *     tags: [OTP]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Expired OTPs cleaned up
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
 *                   example: 'Expired OTPs cleaned up successfully'
 *                 data:
 *                   type: object
 *                   properties:
 *                     deletedCount: number
 *       401:
 *         description: Unauthorized
 */
export const cleanupExpiredOtps = asyncHandler(async (
  req: Request,
  res: Response
): Promise<void> => {
  const deletedCount = await OtpService.cleanupExpiredOtps();

  const response = createSuccessResponse(
    { deletedCount },
    'Expired OTPs cleaned up successfully'
  );

  res.status(200).json(response);
});