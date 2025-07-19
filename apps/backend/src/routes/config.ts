import { Router, Request, Response } from 'express';
import { Logger } from '@n8n-streamdeck/shared';
import { config } from '../config/environment';
import { asyncHandler } from '../middleware/errorHandler';
import { ConfigController } from '../controllers/configController';

const router = Router();
const logger = new Logger({ level: config.logLevel }, 'ConfigRoute');

// Initialize controller
const configController = new ConfigController();

// GET /api/config - Get application configuration
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    await configController.getConfig(req, res);
  })
);

// PUT /api/config - Update application configuration
router.put(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    await configController.updateConfig(req, res);
  })
);

// GET /api/config/schema - Get configuration schema
router.get(
  '/schema',
  asyncHandler(async (req: Request, res: Response) => {
    await configController.getConfigSchema(req, res);
  })
);

// POST /api/config/validate - Validate configuration
router.post(
  '/validate',
  asyncHandler(async (req: Request, res: Response) => {
    await configController.validateConfiguration(req, res);
  })
);

// POST /api/config/reset - Reset configuration to defaults
router.post(
  '/reset',
  asyncHandler(async (req: Request, res: Response) => {
    await configController.resetConfig(req, res);
  })
);

// GET /api/config/health - Get configuration health status
router.get(
  '/health',
  asyncHandler(async (req: Request, res: Response) => {
    await configController.getConfigHealth(req, res);
  })
);

export default router;
