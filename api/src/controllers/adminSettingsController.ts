import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import Joi from 'joi';
import { sendSms } from '../utils/sms';

// Validation schemas
const createSettingSchema = Joi.object({
  key: Joi.string().required().min(1).max(255),
  value: Joi.any().required()
});


/**
 * @swagger
 * components:
 *   schemas:
 *     Setting:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         key:
 *           type: string
 *         value:
 *           type: object
 *       required:
 *         - key
 *         - value
 */

/**
 * @swagger
 * /api/v1/admin/settings:
 *   post:
 *     summary: Create a new setting
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               key:
 *                 type: string
 *                 example: "max_upload_size"
 *               value:
 *                 type: object
 *                 example: { "size": 5242880, "unit": "bytes" }
 *             required:
 *               - key
 *               - value
 *     responses:
 *       201:
 *         description: Setting created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const createSetting = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = createSettingSchema.validate(req.body);
    
    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        }
      });
      return;
    }

    const { key, value: settingValue } = value;

    // Check if setting with this key already exists
    const existingSetting = await prisma.setting.findUnique({
      where: { key }
    });

    if (existingSetting) {
      res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_KEY',
          message: 'Setting with this key already exists'
        }
      });
      return;
    }

    const setting = await prisma.setting.create({
      data: {
        key,
        value: settingValue
      }
    });

    res.status(201).json({
      success: true,
      data: setting,
      message: 'Setting created successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/settings:
 *   get:
 *     summary: Get all system settings as a single object
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System settings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const getAllSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Define the system settings keys we want to retrieve
    const systemSettingKeys = [
      'booking_price',
      'reminder_expiration_days',
      'sms_notifications_enabled',
      'notification_default_channels',
      'auto_refund_days',
      'auto_complete_booking_days',
      'auto_cancel_booking_days',
      'subscription_price',
      'subscription_duration',
      'free_ad_duration',
      'service_fee_fixed',
      'hero_title',
      'hero_subtitle',
      'hero_image',
      'customer_care_email'
    ];

    // Get all the system settings
    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: systemSettingKeys
        }
      }
    });

    // Convert to a single object structure
    const settingsObject: any = { system: {} };

    settings.forEach(setting => {
      // Convert snake_case key to camelCase
      const camelCaseKey = setting.key
        .replace(/_([a-z])/g, (g) => g[1].toUpperCase());

      settingsObject.system[camelCaseKey] = setting.value;
    });

    // Ensure all expected keys exist with default values if not found
    const defaults = {
      bookingPrice: 0,
      reminderExpirationDays: [15, 13, 10],
      smsNotificationsEnabled: true,
      notificationDefaultChannels: ['push', 'email', 'sms'],
      autoRefundDays: 0,
      autoCompleteBookingDays: 7,
      autoCancelBookingDays: 3,
      subscriptionPrice: 0,
      subscriptionDuration: 0,
      freeAdDuration: 7,
      serviceFeeFixed: 0,
      heroTitle: 'Find Everything You Need',
      heroSubtitle: 'Discover amazing deals on products and services near you',
      heroImage: 'https://placehold.co/1920x500/CC1614/FFFFFF?text=Hero+Banner',
      customerCareEmail: 'info@pinnpost.com'
    };

    for (const [key, defaultValue] of Object.entries(defaults)) {
      if (settingsObject.system[key] === undefined) {
        settingsObject.system[key] = defaultValue;
      }
    }

    res.status(200).json({
      success: true,
      data: settingsObject
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/settings/{settingId}:
 *   get:
 *     summary: Get a specific setting
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: settingId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Setting ID
 *     responses:
 *       200:
 *         description: Setting retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const getSettingById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { settingId } = req.params;

    const setting = await prisma.setting.findUnique({
      where: { id: settingId }
    });

    if (!setting) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Setting not found'
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: setting
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/settings:
 *   put:
 *     summary: Update system settings
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               system:
 *                 type: object
 *                 properties:
 *                   bookingPrice:
 *                     type: number
 *                     example: 9.99
 *                   reminderExpirationDays:
 *                     type: number
 *                     example: 3
 *                   autoRefundDays:
 *                     type: number
 *                     example: 7
 *                   subscriptionPrice:
 *                     type: number
 *                     example: 99
 *                   subscriptionDuration:
 *                     type: number
 *                     example: 7
 *     responses:
 *       200:
 *         description: System settings updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const updateSetting = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Validate the request body structure
    const systemSettings = req.body.system;

    if (!systemSettings) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'System settings object is required'
        }
      });
      return;
    }

    // Define the system settings keys we want to update
    const systemSettingKeys = [
      'booking_price',
      'reminder_expiration_days',
      'sms_notifications_enabled',
      'notification_default_channels',
      'auto_refund_days',
      'auto_complete_booking_days',
      'auto_cancel_booking_days',
      'subscription_price',
      'subscription_duration',
      'free_ad_duration',
      'service_fee_fixed',
      'hero_title',
      'hero_subtitle',
      'hero_image',
      'customer_care_email'
    ];

    // Update each setting individually
    for (const [key, value] of Object.entries(systemSettings)) {
      // Convert camelCase key to snake_case
      const snakeCaseKey = key
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, ''); // Remove leading underscore if any

      // Only update if it's one of our system settings
      if (systemSettingKeys.includes(snakeCaseKey)) {
        // Check if setting exists
        const existingSetting = await prisma.setting.findUnique({
          where: { key: snakeCaseKey }
        });

        if (existingSetting) {
          // Update existing setting
          await prisma.setting.update({
            where: { key: snakeCaseKey },
            data: { value: value as any }
          });
        } else {
          // Create new setting if it doesn't exist
          await prisma.setting.create({
            data: {
              key: snakeCaseKey,
              value: value as any
            }
          });
        }
      }
    }

    // Return the updated settings
    const updatedSettings = await prisma.setting.findMany({
      where: {
        key: {
          in: systemSettingKeys
        }
      }
    });

    const settingsObject: any = { system: {} };

    updatedSettings.forEach(setting => {
      // Convert snake_case key to camelCase
      const camelCaseKey = setting.key
        .replace(/_([a-z])/g, (g) => g[1].toUpperCase())
        .replace(/^([a-z])/, (g) => g[0].toUpperCase());

      settingsObject.system[camelCaseKey] = setting.value;
    });

    res.status(200).json({
      success: true,
      data: settingsObject,
      message: 'System settings updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/settings/{settingId}:
 *   delete:
 *     summary: Delete a setting
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: settingId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Setting ID
 *     responses:
 *       200:
 *         description: Setting deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const deleteSetting = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { settingId } = req.params;

    const setting = await prisma.setting.findUnique({
      where: { id: settingId }
    });

    if (!setting) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Setting not found'
        }
      });
      return;
    }

    await prisma.setting.delete({
      where: { id: settingId }
    });

    res.status(200).json({
      success: true,
      message: 'Setting deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Test SMS configuration endpoint
const testSmsSchema = Joi.object({
  phoneNumber: Joi.string().required().pattern(/^[0-9]{10}$/)
});

export const testSmsConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = testSmsSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        }
      });
      return;
    }

    const result = await sendSms(
      value.phoneNumber,
      'Test SMS: configuration verified'
    );

    if (!result.success) {
      res.status(502).json({
        success: false,
        error: {
          code: 'SMS_SEND_FAILED',
          message: result.error || 'Failed to send test SMS'
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { provider: result.provider },
      message: 'Test SMS sent successfully'
    });
  } catch (error) {
    next(error);
  }
};
