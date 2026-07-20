import { config } from '../config/environment';
import { notificationTemplates } from '../config/notification-templates';
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import fs from 'fs';
import path from 'path';

type Provider = 'techbeeshive';

export interface SmsSendOptions {
  unicode?: boolean;
  templateId?: string;
}

interface SmsConfig {
  provider: Provider;
  apiKey?: string;
  senderId?: string;
  baseUrl?: string;
  format?: 'json' | 'php';
  unicode?: boolean;
  useTemplateId?: boolean;
  dltTemplateId?: string;
}

interface SmsApiResponse {
  status?: string;
  code?: string;
}

interface ConfigSms {
  provider?: string;
  apiKey?: string;
  senderId?: string;
  baseUrl?: string;
  format?: string;
  unicode?: boolean;
  dltTemplateId?: string;
}

function normalizeNumber(e164: string): string {
  const digits = e164.replace(/^\+/, '').replace(/\D/g, '');
  return digits;
}

async function getSmsConfig(): Promise<SmsConfig> {
  // Only use environment variables, not database
  return {
    provider: ((config.sms as ConfigSms).provider || 'techbeeshive') as Provider,
    apiKey: (config.sms as ConfigSms).apiKey,
    senderId: (config.sms as ConfigSms).senderId,
    baseUrl: (config.sms as ConfigSms).baseUrl,
    format: ((config.sms as ConfigSms).format || 'json') as 'json' | 'php',
    unicode: (config.sms as ConfigSms).unicode,
    useTemplateId: (config.sms as any).useTemplateId !== undefined ? (config.sms as any).useTemplateId : true,
    dltTemplateId: (config.sms as ConfigSms).dltTemplateId,
  };
}

interface HttpResponse {
  body: string;
  statusCode?: number;
  headers?: Record<string, string | string[] | undefined>;
}

function httpGet(url: string): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(parsed, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({
        body: data,
        statusCode: res.statusCode,
        headers: res.headers as Record<string, string | string[] | undefined>
      }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function sendViaTechBeeHive(to: string, message: string, opts: SmsSendOptions, cfg: SmsConfig) {
  if (!cfg.apiKey || !cfg.senderId || !cfg.baseUrl) {
    return { success: false, error: 'SMS provider not configured' };
  }

  const number = normalizeNumber(to);
  const params = new URLSearchParams();
  params.set('apikey', cfg.apiKey);
  params.set('senderid', cfg.senderId);
  params.set('number', number);
  params.set('message', message);
  // params.set('format', cfg.format || 'json'); // Removed format parameter
  if (opts.unicode || cfg.unicode) params.set('unicode', '2');
  // Only include template ID if the setting is enabled
  if (cfg.useTemplateId && (opts.templateId || cfg.dltTemplateId)) {
    params.set('templateid', opts.templateId || cfg.dltTemplateId!);
  }

  const url = `${cfg.baseUrl}?${params.toString()}`;

  // Create sanitized URL for logging (hide API key)
  const sanitizedParams = new URLSearchParams(params);
  sanitizedParams.set('apikey', '***REDACTED***');
  const sanitizedUrl = `${cfg.baseUrl}?${sanitizedParams.toString()}`;

  const requestData = {
    timestamp: new Date().toISOString(),
    provider: 'techbeeshive',
    url: sanitizedUrl,
    method: 'GET',
    params: {
      to: number,
      senderId: cfg.senderId,
      format: cfg.format || 'json',
      unicode: opts.unicode || cfg.unicode,
      templateId: opts.templateId || cfg.dltTemplateId,
      messageLength: message.length
    }
  };

  console.log('[SMS API REQUEST]', requestData);

  try {
    const response = await httpGet(url);
    let parsed: SmsApiResponse | undefined = undefined;
    try {
      parsed = JSON.parse(response.body) as SmsApiResponse;
    } catch {
      // non-JSON responses still treated as success if contains 'Success'
    }

    const responseData = {
      timestamp: new Date().toISOString(),
      provider: 'techbeeshive',
      to: number,
      statusCode: response.statusCode,
      headers: response.headers,
      body: response.body.substring(0, 500), // Limit body length for logging
      parsed: parsed || 'non-json-response'
    };

    console.log('[SMS API RESPONSE]', responseData);

    const ok =
      (parsed && (parsed.status === 'Success' || parsed.code === '011')) ||
      /Success/i.test(response.body);

    const result = { success: !!ok, providerResponse: parsed || response.body };

    // Log the SMS attempt with request and response details
    logSmsToFile({
      to: number,
      message,
      provider: 'techbeeshive',
      success: result.success,
      request: requestData,
      response: responseData
    });

    return result;
  } catch (error: unknown) {
    const errorData = {
      timestamp: new Date().toISOString(),
      provider: 'techbeeshive',
      to: number,
      error: (error as Error)?.message || 'SMS send failed',
      stack: (error as Error)?.stack
    };

    console.error('[SMS API ERROR]', errorData);

    // Log the SMS attempt with error details
    logSmsToFile({
      to: number,
      message,
      provider: 'techbeeshive',
      success: false,
      request: requestData,
      error: errorData.error
    });

    return { success: false, error: errorData.error };
  }
}

// Function to log SMS to file
interface LogSmsToFileOptions {
  to: string;
  message: string;
  provider: Provider;
  success: boolean;
  request?: {
    url?: string;
    sanitizedUrl?: string;
    method?: string;
    params?: Record<string, any>;
  };
  response?: {
    statusCode?: number;
    headers?: Record<string, string | string[] | undefined>;
    body?: string;
    parsed?: any;
  };
  error?: string;
}

function logSmsToFile(options: LogSmsToFileOptions) {
  try {
    const timestamp = new Date().toISOString();
    // Use a relative path from the project root
    const logDir = path.join(process.cwd(), 'logs');

    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logFilePath = path.join(logDir, `sms-${new Date().toISOString().split('T')[0]}.log`);

    const logEntry = {
      timestamp,
      phoneNumber: options.to,
      message: options.message.substring(0, 100) + (options.message.length > 100 ? '...' : ''), // Truncate long messages
      provider: options.provider,
      success: options.success,
      request: options.request || null,
      response: options.response || null,
      error: options.error || null
    };

    const logLine = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(logFilePath, logLine);
  } catch (logError) {
    console.error('Failed to log SMS:', logError);
  }
}

export async function sendSms(
  to: string,
  message: string,
  opts: SmsSendOptions = {}
): Promise<{ success: boolean; provider: Provider; response?: { status?: string; code?: string } | string; error?: string }> {
  const cfg = await getSmsConfig();
  let result;

  if (cfg.provider === 'techbeeshive') {
    result = await sendViaTechBeeHive(to, message, opts, cfg);
  } else {
    result = { success: false, error: 'Selected SMS provider not implemented' };
  }

  return {
    success: result.success,
    provider: cfg.provider,
    response: result.providerResponse,
    error: result.error
  };
}

export async function sendOtpSms(to: string, otp: string) {
  const { message, templateId } = buildOtpSms(otp);
  return sendSms(to, message, {
    templateId: templateId || 'empty',
  });
}

/**
 * Build the OTP SMS message and template id without sending.
 * Used by the OTP background handler so the rendered message can be
 * stored on the outbox row before the drain cron retries.
 */
export function buildOtpSms(otp: string): { message: string; templateId?: string } {
  const brand = (config.sms.brand || 'pinnpost') as 'pinnpost' | 'inaipro';
  const template = notificationTemplates.otp[brand].sms;
  return {
    message: template.message({ otp }),
    templateId: template.templateId,
  };
}

