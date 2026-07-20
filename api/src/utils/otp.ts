import { prisma } from './database';
import { isDevMode, config } from '../config/environment';
import { createEmailOtpJob, createSmsOtpJob } from '../background/handlers/otp.handler';

export enum OtpType {
  REGISTRATION = 'registration',
  PASSWORD_RESET = 'password_reset',
  ADMIN_PASSWORD_RESET = 'admin_password_reset',
  EMAIL_VERIFICATION = 'email_verification',
  PHONE_VERIFICATION = 'phone_verification',
  LOGIN = 'login'
}

export interface OtpData {
  id: string;
  phone: string; // For admin OTPs, this stores the email
  code: string;
  type: OtpType;
  isUsed: boolean;
  expiresAt: Date;
  createdAt: Date;
}

export interface OtpRequestOptions {
  type: OtpType;
  channel?: 'email' | 'sms'; // Specify the delivery channel
  templateId?: string; // For SMS templates
}

export class OtpService {
  private static readonly OTP_LENGTH = 6;
  private static readonly EXPIRATION_MINUTES = 10;

  /**
   * Generate a random OTP code
   */
  static generateOTP(): string {
    // Always generate a real random OTP
    // In dev mode, users can use either this real OTP or the static test OTP (123456) for verification
    return Math.floor(Math.random() * 900000 + 100000).toString();
  }

  /**
   * Send OTP via the appropriate channel (email or SMS)
   * Uses job queue for non-blocking async processing
   */
  static async sendOtp(identifier: string, otp: string, options: OtpRequestOptions): Promise<{
    success: boolean;
    devMode?: boolean;
    otp?: string;
    error?: string
  }> {
    // Determine if this is an email or phone number
    const isEmail = identifier.includes('@');
    const channel = options.channel || (isEmail ? 'email' : 'sms');

    console.log(`[OTP SENDING] identifier=${identifier}, otp=${otp}, channel=${channel}, isDevMode=${isDevMode()}`);

    try {
      // Add job to queue for async processing (non-blocking)
      if (channel === 'email') {
        await createEmailOtpJob({ to: identifier, otp });
        console.log(`[OTP] Email OTP job queued for ${identifier}`);
      } else {
        await createSmsOtpJob({ to: identifier, otp });
        console.log(`[OTP] SMS OTP job queued for ${identifier}`);
      }

      // In development mode, include devMode flag and OTP in response for convenience
      // Note: SMS is still sent even in dev mode
      if (isDevMode()) {
        return {
          success: true,
          devMode: true,
          otp
        };
      }

      return { success: true };
    } catch (error) {
      console.error(`[OTP] Error queuing ${channel} OTP job:`, error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Create and send a new OTP
   */
  static async createAndSendOtp(identifier: string, options: OtpRequestOptions): Promise<{
    otpRecord: OtpData;
    sendResult: { success: boolean; devMode?: boolean; otp?: string; error?: string };
  }> {
    const otpCode = this.generateOTP();
    const expiresAt = new Date(Date.now() + this.EXPIRATION_MINUTES * 60 * 1000); // 10 minutes from now

    // Expire any existing unused OTPs for this identifier and type before creating a new one
    await prisma.otp.updateMany({
      where: {
        phone: identifier,
        type: options.type as string,
        isUsed: false,
        expiresAt: {
          gt: new Date()
        }
      },
      data: {
        expiresAt: new Date() // Set expiration time to now to mark as expired
      }
    });

    // Save OTP to database
    const otpPrisma = await prisma.otp.create({
      data: {
        phone: identifier, // Store email or phone in the phone field
        code: otpCode,
        type: options.type as string, // Cast to string for Prisma
        expiresAt
      }
    });

    // Convert Prisma result to OtpData interface
    const otpRecord: OtpData = {
      id: otpPrisma.id,
      phone: otpPrisma.phone,
      code: otpPrisma.code,
      type: otpPrisma.type as OtpType, // Cast back to OtpType
      isUsed: otpPrisma.isUsed,
      expiresAt: otpPrisma.expiresAt,
      createdAt: otpPrisma.createdAt
    };

    // Send OTP
    const sendResult = await this.sendOtp(identifier, otpCode, options);

    return { otpRecord, sendResult };
  }

  /**
   * Verify an OTP code
   */
  static async verifyOtp(identifier: string, otp: string, type: OtpType): Promise<OtpData | null> {
    // Debug logging
    console.log(`[OTP VERIFY] identifier=${identifier}, otp=${otp}, type=${type}`);
    console.log(`[OTP VERIFY] isDevMode=${isDevMode()}, testOtp=${config.testing.testOtp}`);

    // In development mode, allow TEST_OTP (default: 123456) to work as a static bypass
    // User can use either the real OTP from SMS or the static test OTP
    if (isDevMode() && config.testing.testOtp && otp === config.testing.testOtp) {
      console.log(`[DEV MODE] Using static TEST_OTP ${config.testing.testOtp} for ${identifier}`);

      // Try to find the most recent valid OTP for this identifier and type
      // and mark it as used (since user verified successfully with static OTP)
      const validOtp = await prisma.otp.findFirst({
        where: {
          phone: identifier,
          type: type as string,
          isUsed: false,
          expiresAt: {
            gt: new Date()
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (validOtp) {
        // Mark the real OTP as used (consumed by static OTP verification)
        await prisma.otp.update({
          where: { id: validOtp.id },
          data: { isUsed: true }
        });

        // Return the real OTP data (but verification was done via static code)
        const otpData: OtpData = {
          id: validOtp.id,
          phone: validOtp.phone,
          code: validOtp.code,
          type: validOtp.type as OtpType,
          isUsed: true,
          expiresAt: validOtp.expiresAt,
          createdAt: validOtp.createdAt
        };
        return otpData;
      } else {
        // If no OTP exists in DB but we're in dev mode with test OTP, return a mock object
        return {
          id: 'dev-mode-test-otp',
          phone: identifier,
          code: otp,
          type: type,
          isUsed: true,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 mins from now
          createdAt: new Date()
        };
      }
    }

    // Find valid OTP in database (for production or when not using test OTP)
    const validOtp = await prisma.otp.findFirst({
      where: {
        phone: identifier,
        code: otp,
        type: type as string, // Cast to string to match Prisma schema
        isUsed: false,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (!validOtp) {
      return null;
    }

    // Mark OTP as used
    await prisma.otp.update({
      where: { id: validOtp.id },
      data: { isUsed: true }
    });

    // Return the OTP data with proper typing
    const otpData: OtpData = {
      id: validOtp.id,
      phone: validOtp.phone,
      code: validOtp.code,
      type: validOtp.type as OtpType, // Cast back to OtpType
      isUsed: validOtp.isUsed,
      expiresAt: validOtp.expiresAt,
      createdAt: validOtp.createdAt
    };
    return otpData;
  }

  /**
   * Clean up expired OTPs (for maintenance purposes)
   */
  static async cleanupExpiredOtps(): Promise<number> {
    const result = await prisma.otp.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });
    return result.count;
  }
}