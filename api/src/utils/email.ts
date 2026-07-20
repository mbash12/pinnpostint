import nodemailer from 'nodemailer';
import { config } from '../config/environment';
import { notificationTemplates } from '../config/notification-templates';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean; // true for 465, false for other ports
  auth: {
    user: string;
    pass: string;
  };
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(config?: EmailConfig) {
    if (config) {
      this.transporter = nodemailer.createTransport(config);
    } else {
      // Use environment configuration
      const emailConfig = this.getDefaultConfig();
      this.transporter = nodemailer.createTransport(emailConfig);
    }
  }

  private getDefaultConfig(): EmailConfig {
    if (!config.email.smtpHost || !config.email.smtpUser || !config.email.smtpPass) {
      throw new Error('SMTP configuration is missing. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS in environment variables.');
    }

    return {
      host: config.email.smtpHost,
      port: config.email.smtpPort || 587,
      secure: config.email.smtpPort === 465, // true for 465, false for other ports
      auth: {
        user: config.email.smtpUser,
        pass: config.email.smtpPass,
      },
    };
  }

  async sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
    try {
      const mailOptions = {
        from: options.from || `"${config.email.fromName || 'PinNPost'}" <${config.email.fromEmail}>`,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent:', info.messageId);
      return { success: true };
    } catch (error) {
      console.error('Error sending email:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  async sendOtpEmail(to: string, otp: string): Promise<{ success: boolean; error?: string }> {
    const subject = 'Your Pin N Post Verification Code';
    const body = `To complete your sign-up or verification process, please use the one-time password (OTP) provided below. This code is valid for 10 minutes.`;
    
    const html = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #f0f0f0; border-radius: 8px; color: #333;">
        <h2 style="font-size: 24px; font-weight: 600; color: #1a1a1a; margin-bottom: 24px;">Verify your account</h2>
        <p style="font-size: 16px; line-height: 1.6; color: #4b4b4b; margin-bottom: 32px;">${body}</p>
        <div style="background-color: #f8f9fa; padding: 24px; text-align: center; border-radius: 6px; margin-bottom: 32px;">
          <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #007bff; font-family: monospace;">${otp}</span>
        </div>
        <p style="font-size: 14px; line-height: 1.5; color: #888; margin-bottom: 24px;">If you did not request this code, you can safely ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 32px 0;" />
        <p style="font-size: 12px; color: #b0b0b0; text-align: center;">&copy; ${new Date().getFullYear()} Pin N Post. All rights reserved.</p>
      </div>
    `;
    
    return this.sendEmail({
      to,
      subject,
      html,
    });
  }
}

// Singleton instance
let emailService: EmailService | null = null;

export const getEmailService = (): EmailService => {
  if (!emailService) {
    try {
      emailService = new EmailService();
    } catch (error) {
      console.error('Failed to initialize email service:', error);
      throw error;
    }
  }
  return emailService;
};