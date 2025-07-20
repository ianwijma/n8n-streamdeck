import {
  Router,
  Request,
  Response,
  type Router as ExpressRouter,
} from 'express';
import { Logger } from '@n8n-streamdeck/shared';
import { config } from '../config/environment';
import { asyncHandler } from '../middleware/errorHandler';
import { ButtonController } from '../controllers/buttonController';
import { StreamDeckService } from '../services/streamDeckService';

const router: ExpressRouter = Router({ mergeParams: true }); // Important: merge params to get deviceId
const logger = new Logger({ level: config.logLevel }, 'DeviceButtonsRoute');

// Initialize StreamDeck service and controller
const streamDeckService = StreamDeckService.getInstance();
const buttonController = new ButtonController(streamDeckService);

// GET /api/devices/:deviceId/buttons - List all buttons for device
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    await buttonController.listButtons(req, res);
  })
);

// POST /api/devices/:deviceId/buttons - Create/update button configuration
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    await buttonController.createOrUpdateButton(req, res);
  })
);

// GET /api/devices/:deviceId/buttons/:buttonId - Get button details
router.get(
  '/:buttonId',
  asyncHandler(async (req: Request, res: Response) => {
    await buttonController.getButton(req, res);
  })
);

// PUT /api/devices/:deviceId/buttons/:buttonId - Update button configuration
router.put(
  '/:buttonId',
  asyncHandler(async (req: Request, res: Response) => {
    await buttonController.updateButton(req, res);
  })
);

// DELETE /api/devices/:deviceId/buttons/:buttonId - Delete button
router.delete(
  '/:buttonId',
  asyncHandler(async (req: Request, res: Response) => {
    await buttonController.deleteButton(req, res);
  })
);

// POST /api/devices/:deviceId/buttons/:buttonId/press - Simulate button press
router.post(
  '/:buttonId/press',
  asyncHandler(async (req: Request, res: Response) => {
    await buttonController.pressButton(req, res);
  })
);

// POST /api/devices/:deviceId/buttons/:buttonId/move - Move button to new position
router.post(
  '/:buttonId/move',
  asyncHandler(async (req: Request, res: Response) => {
    await buttonController.moveButton(req, res);
  })
);

// POST /api/devices/:deviceId/buttons/:buttonId/swap - Swap two buttons
router.post(
  '/:buttonId/swap',
  asyncHandler(async (req: Request, res: Response) => {
    await buttonController.swapButtons(req, res);
  })
);

// POST /api/devices/:deviceId/buttons/:buttonId/copy - Copy button to new position
router.post(
  '/:buttonId/copy',
  asyncHandler(async (req: Request, res: Response) => {
    await buttonController.copyButton(req, res);
  })
);

// DELETE /api/devices/:deviceId/buttons - Clear all buttons
router.delete(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    await buttonController.clearAllButtons(req, res);
  })
);

export default router;
