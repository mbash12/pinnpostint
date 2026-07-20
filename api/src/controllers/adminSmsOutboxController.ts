import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import {
  drainOutbox,
  getOutboxStats,
  listOutboxRows,
  retryOutboxRow,
} from '../utils/smsOutbox';
import { computeAdSmsTracker, computeForecast } from '../utils/smsForecast';
import { OutgoingSmsStatus } from '@prisma/client';
import { getJobQueueManager } from '../background/utils/initialization';

const listQuerySchema = Joi.object({
  status: Joi.string()
    .valid('PENDING', 'SENT', 'FAILED', 'DEAD')
    .optional(),
  kind: Joi.string().valid('notification', 'otp', 'admin-test').optional(),
  search: Joi.string().max(128).optional().allow(''),
  label: Joi.string().max(64).optional().allow(''),
  reminderDays: Joi.number().integer().min(1).max(365).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(25),
});

const retryParamsSchema = Joi.object({
  id: Joi.string().uuid().required(),
});

/**
 * GET /api/v1/admin/sms-outbox
 *
 * Returns:
 *  - counts: { PENDING, SENT, FAILED, DEAD }
 *  - rows:   paginated list of outbox rows (newest first)
 *  - pagination: { page, limit, total }
 */
export const getOutboxOverview = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = listQuerySchema.validate(req.query, {
      stripUnknown: true,
      abortEarly: false,
    });
    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: error.details.map((d) => ({
            field: d.path.join('.'),
            message: d.message,
          })),
        },
      });
      return;
    }

    const { status, kind, search, label, reminderDays, page, limit } = value as {
      status?: OutgoingSmsStatus;
      kind?: 'notification' | 'otp' | 'admin-test';
      search?: string;
      label?: string;
      reminderDays?: number;
      page: number;
      limit: number;
    };

    const [counts, list] = await Promise.all([
      getOutboxStats(),
      listOutboxRows(undefined, {
        status,
        kind,
        search: search || undefined,
        label: label || undefined,
        reminderDays,
        page,
        limit,
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        counts,
        rows: list.rows,
        pagination: {
          page: list.page,
          limit: list.limit,
          total: list.total,
          totalPages: Math.max(1, Math.ceil(list.total / list.limit)),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/admin/sms-outbox/:id/retry
 *
 * Re-queues a FAILED row so the drain job picks it up immediately.
 * Idempotent: retrying an already-PENDING row returns 409.
 */
export const retryOutboxRowHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = retryParamsSchema.validate(req.params, {
      abortEarly: false,
    });
    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid row id',
          details: error.details.map((d) => ({
            field: d.path.join('.'),
            message: d.message,
          })),
        },
      });
      return;
    }

    const result = await retryOutboxRow(undefined, value.id);
    if (!result.ok) {
      const code =
        result.reason === 'not_found'
          ? 'NOT_FOUND'
          : 'ALREADY_PENDING';
      const status = result.reason === 'not_found' ? 404 : 409;
      res.status(status).json({
        success: false,
        error: {
          code,
          message:
            result.reason === 'not_found'
              ? `Outbox row ${value.id} not found`
              : `Outbox row ${value.id} is already PENDING`,
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { row: result.row },
      message: 'Outbox row re-queued for retry',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/admin/sms-outbox/drain
 *
 * Manually triggers the sms-outbox-drain Bull job (no params). Useful
 * for ops when a backlog has built up and they don't want to wait for
 * the next cron tick.
 */
export const triggerOutboxDrainHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const manager = getJobQueueManager();
    if (!manager) {
      res.status(503).json({
        success: false,
        error: {
          code: 'JOB_SYSTEM_UNAVAILABLE',
          message: 'Background job system is not running on this instance',
        },
      });
      return;
    }

    const result = await drainOutbox(undefined, { batchSize: 100 });
    res.status(200).json({
      success: true,
      data: result,
      message: 'Outbox drain complete',
    });
  } catch (err) {
    next(err);
  }
};

const forecastQuerySchema = Joi.object({
  // Legacy day forecast (optional). When omitted, returns ad-centric tracker.
  date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  search: Joi.string().max(128).optional().allow(''),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(25),
});

/**
 * GET /api/v1/admin/sms-outbox/forecast
 *
 * Default (no date): ad-centric tracker — each ad with pre-expiry / expiry /
 * last post-expiry / next post-expiry slots and sent vs scheduled status.
 *
 * Legacy: ?date=YYYY-MM-DD returns the old per-day expected-send list.
 */
export const getSmsForecast = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = forecastQuerySchema.validate(req.query, {
      stripUnknown: true,
      abortEarly: false,
    });
    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: error.details.map((d) => ({
            field: d.path.join('.'),
            message: d.message,
          })),
        },
      });
      return;
    }

    if (value.date) {
      const targetDate = new Date(value.date + 'T00:00:00');
      if (isNaN(targetDate.getTime())) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_DATE', message: 'Invalid date value' },
        });
        return;
      }

      const forecast = await computeForecast(targetDate);
      res.status(200).json({
        success: true,
        data: {
          mode: 'day',
          date: value.date,
          rows: forecast.rows,
          summary: forecast.summary,
          total: forecast.rows.length,
        },
      });
      return;
    }

    const tracker = await computeAdSmsTracker({
      search: value.search || undefined,
      page: value.page,
      limit: value.limit,
    });

    res.status(200).json({
      success: true,
      data: {
        mode: 'ads',
        ...tracker,
      },
    });
  } catch (err) {
    next(err);
  }
};
