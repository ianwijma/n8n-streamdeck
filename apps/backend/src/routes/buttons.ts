import { Router, Request, Response } from 'express';
import { Logger } from '@n8n-streamdeck/shared';
import { config } from '../config/environment';
import { asyncHandler } from '../middleware/errorHandler';
import { ButtonController } from '../controllers/buttonController';
import { StreamDeckService } from '../services/streamDeckService';

const router = Router();
const logger = new Logger({ level: config.logLevel }, 'ButtonsRoute');

// Initialize StreamDeck service and controller
const streamDeckService = new StreamDeckService();
const buttonController = new ButtonController(streamDeckService);

// GET /api/buttons - List buttons (requires deviceId query param)
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const deviceId = req.query.deviceId as string;
    if (deviceId) {
      req.params.deviceId = deviceId;
      await buttonController.listButtons(req, res);
    } else {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'deviceId query parameter is required',
        },
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      });
    }
  })
);

export default router;
