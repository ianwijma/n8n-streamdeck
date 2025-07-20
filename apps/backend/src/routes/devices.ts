import {
  Router,
  Request,
  Response,
  type Router as ExpressRouter,
} from 'express';
import { Logger } from '@n8n-streamdeck/shared';
import { config } from '../config/environment';
import { asyncHandler } from '../middleware/errorHandler';
import { DeviceController } from '../controllers/deviceController';
import { StreamDeckService } from '../services/streamDeckService';

const router: ExpressRouter = Router();
const logger = new Logger({ level: config.logLevel }, 'DevicesRoute');

// Initialize StreamDeck service and controller
const streamDeckService = StreamDeckService.getInstance();
const deviceController = new DeviceController(streamDeckService);

// GET /api/devices - List all devices
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    await deviceController.listDevices(req, res);
  })
);

// GET /api/devices/:id - Get device by ID
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    await deviceController.getDevice(req, res);
  })
);

// POST /api/devices/:id/connect - Connect to device
router.post(
  '/:id/connect',
  asyncHandler(async (req: Request, res: Response) => {
    await deviceController.connectDevice(req, res);
  })
);

// DELETE /api/devices/:id - Disconnect device
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    await deviceController.disconnectDevice(req, res);
  })
);

// GET /api/devices/:id/status - Get device status
router.get(
  '/:id/status',
  asyncHandler(async (req: Request, res: Response) => {
    await deviceController.getDeviceStatus(req, res);
  })
);

// PUT /api/devices/:id/brightness - Update device brightness
router.put(
  '/:id/brightness',
  asyncHandler(async (req: Request, res: Response) => {
    await deviceController.updateBrightness(req, res);
  })
);

export default router;
