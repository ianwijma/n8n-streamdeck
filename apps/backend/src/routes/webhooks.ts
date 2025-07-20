import {
  Router,
  Request,
  Response,
  type Router as ExpressRouter,
} from 'express';
import { Logger } from '@n8n-streamdeck/shared';
import { config } from '../config/environment';
import { asyncHandler } from '../middleware/errorHandler';
import { WebhookService } from '../services/webhookService';

const router: ExpressRouter = Router();
const logger = new Logger({ level: config.logLevel }, 'WebhooksRoute');
const webhookService = WebhookService.getInstance();

// POST /api/webhooks - Register a new webhook
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const {
      url,
      deviceId,
      buttonId,
      events = ['pressed'],
      metadata,
    } = req.body;

    // Validate required fields
    if (!url || !deviceId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'URL and deviceId are required',
        },
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid URL format',
        },
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      });
    }

    // Validate events
    const validEvents = ['pressed', 'released'];
    const invalidEvents = events.filter(
      (event: string) => !validEvents.includes(event)
    );
    if (invalidEvents.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid events: ${invalidEvents.join(', ')}. Valid events are: ${validEvents.join(', ')}`,
        },
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      });
    }

    const webhook = webhookService.registerWebhook({
      url,
      deviceId,
      buttonId,
      events,
      active: true,
      metadata,
    });

    logger.info('Webhook registered via API', {
      requestId: req.requestId,
      webhookId: webhook.id,
      url: webhook.url,
      deviceId: webhook.deviceId,
      buttonId: webhook.buttonId,
    });

    res.status(201).json({
      success: true,
      data: webhook,
      message: 'Webhook registered successfully',
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    });
  })
);

// GET /api/webhooks - List all webhooks
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const webhooks = webhookService.getWebhooks();

    res.json({
      success: true,
      data: webhooks,
      message: `Found ${webhooks.length} webhooks`,
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    });
  })
);

// GET /api/webhooks/:webhookId - Get specific webhook
router.get(
  '/:webhookId',
  asyncHandler(async (req: Request, res: Response) => {
    const { webhookId } = req.params;
    const webhook = webhookService.getWebhook(webhookId);

    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Webhook with ID '${webhookId}' not found`,
        },
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      });
    }

    res.json({
      success: true,
      data: webhook,
      message: 'Webhook found',
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    });
  })
);

// PATCH /api/webhooks/:webhookId - Update webhook
router.patch(
  '/:webhookId',
  asyncHandler(async (req: Request, res: Response) => {
    const { webhookId } = req.params;
    const updates = req.body;

    // Prevent updating certain fields
    delete updates.id;
    delete updates.createdAt;

    const webhook = webhookService.updateWebhook(webhookId, updates);

    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Webhook with ID '${webhookId}' not found`,
        },
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      });
    }

    logger.info('Webhook updated via API', {
      requestId: req.requestId,
      webhookId: webhook.id,
    });

    res.json({
      success: true,
      data: webhook,
      message: 'Webhook updated successfully',
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    });
  })
);

// DELETE /api/webhooks/:webhookId - Delete webhook
router.delete(
  '/:webhookId',
  asyncHandler(async (req: Request, res: Response) => {
    const { webhookId } = req.params;
    const success = webhookService.unregisterWebhook(webhookId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Webhook with ID '${webhookId}' not found`,
        },
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      });
    }

    logger.info('Webhook deleted via API', {
      requestId: req.requestId,
      webhookId,
    });

    res.json({
      success: true,
      message: 'Webhook deleted successfully',
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    });
  })
);

// POST /api/webhooks/cleanup - Clean up expired webhooks
router.post(
  '/cleanup',
  asyncHandler(async (req: Request, res: Response) => {
    webhookService.cleanup();

    logger.info('Webhook cleanup triggered via API', {
      requestId: req.requestId,
    });

    res.json({
      success: true,
      message: 'Webhook cleanup completed',
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    });
  })
);

export default router;
