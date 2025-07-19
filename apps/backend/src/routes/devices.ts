import { Router, Request, Response } from 'express';
import { 
  createSuccessResponse,
  createErrorResponse,
  Device,
  DeviceType,
  DeviceStatus,
  ApiErrorCode,
  Logger,
  generateUUID
} from '@n8n-streamdeck/shared';
import { config } from '../config/environment';
import { asyncHandler, createNotFoundError, createValidationError } from '../middleware/errorHandler';

const router = Router();
const logger = new Logger({ level: config.logLevel }, 'DevicesRoute');

// Mock data for development
const mockDevices: Device[] = [
  {
    id: 'dev-' + generateUUID(),
    name: 'StreamDeck Original',
    type: DeviceType.STREAMDECK_ORIGINAL,
    serialNumber: 'SD001234567890',
    buttonCount: 15,
    isConnected: true,
    firmwareVersion: '1.0.3',
    brightness: 75,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date(),
  },
  {
    id: 'dev-' + generateUUID(),
    name: 'StreamDeck Mini',
    type: DeviceType.STREAMDECK_MINI,
    serialNumber: 'SD001234567891',
    buttonCount: 6,
    isConnected: false,
    firmwareVersion: '1.0.2',
    brightness: 50,
    createdAt: new Date('2024-01-02T00:00:00Z'),
    updatedAt: new Date(),
  },
];

// GET /api/devices - List all devices
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { includeDisconnected = 'true', page = '1', limit = '10' } = req.query;
  
  logger.info('Fetching devices list', {
    requestId: req.requestId,
    includeDisconnected,
    page,
    limit,
  });

  let devices = [...mockDevices];
  
  // Filter disconnected devices if requested
  if (includeDisconnected === 'false') {
    devices = devices.filter(device => device.isConnected);
  }

  // Pagination
  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const startIndex = (pageNum - 1) * limitNum;
  const endIndex = startIndex + limitNum;
  const paginatedDevices = devices.slice(startIndex, endIndex);

  const response = createSuccessResponse(
    paginatedDevices,
    `Found ${paginatedDevices.length} devices`,
    req.requestId
  );

  // Add pagination metadata
  (response as any).pagination = {
    page: pageNum,
    limit: limitNum,
    total: devices.length,
    totalPages: Math.ceil(devices.length / limitNum),
    hasNext: endIndex < devices.length,
    hasPrev: pageNum > 1,
  };

  res.status(200).json(response);
}));

// GET /api/devices/:id - Get device by ID
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  logger.info('Fetching device by ID', {
    requestId: req.requestId,
    deviceId: id,
  });

  const device = mockDevices.find(d => d.id === id);
  
  if (!device) {
    throw createNotFoundError('Device', id);
  }

  const response = createSuccessResponse(
    device,
    'Device found',
    req.requestId
  );

  res.status(200).json(response);
}));

// POST /api/devices/:id/connect - Connect to device
router.post('/:id/connect', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  logger.info('Connecting to device', {
    requestId: req.requestId,
    deviceId: id,
  });

  const device = mockDevices.find(d => d.id === id);
  
  if (!device) {
    throw createNotFoundError('Device', id);
  }

  if (device.isConnected) {
    throw createValidationError('Device is already connected');
  }

  // Simulate connection
  device.isConnected = true;
  device.updatedAt = new Date();

  const response = createSuccessResponse(
    device,
    'Device connected successfully',
    req.requestId
  );

  res.status(200).json(response);
}));

// POST /api/devices/:id/disconnect - Disconnect from device
router.post('/:id/disconnect', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  logger.info('Disconnecting from device', {
    requestId: req.requestId,
    deviceId: id,
  });

  const device = mockDevices.find(d => d.id === id);
  
  if (!device) {
    throw createNotFoundError('Device', id);
  }

  if (!device.isConnected) {
    throw createValidationError('Device is already disconnected');
  }

  // Simulate disconnection
  device.isConnected = false;
  device.updatedAt = new Date();

  const response = createSuccessResponse(
    device,
    'Device disconnected successfully',
    req.requestId
  );

  res.status(200).json(response);
}));

// PUT /api/devices/:id/brightness - Update device brightness
router.put('/:id/brightness', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { brightness } = req.body;
  
  logger.info('Updating device brightness', {
    requestId: req.requestId,
    deviceId: id,
    brightness,
  });

  if (typeof brightness !== 'number' || brightness < 0 || brightness > 100) {
    throw createValidationError('Brightness must be a number between 0 and 100');
  }

  const device = mockDevices.find(d => d.id === id);
  
  if (!device) {
    throw createNotFoundError('Device', id);
  }

  if (!device.isConnected) {
    throw createValidationError('Cannot update brightness of disconnected device');
  }

  // Update brightness
  device.brightness = brightness;
  device.updatedAt = new Date();

  const response = createSuccessResponse(
    device,
    'Device brightness updated successfully',
    req.requestId
  );

  res.status(200).json(response);
}));

// GET /api/devices/:id/status - Get device status
router.get('/:id/status', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  logger.info('Fetching device status', {
    requestId: req.requestId,
    deviceId: id,
  });

  const device = mockDevices.find(d => d.id === id);
  
  if (!device) {
    throw createNotFoundError('Device', id);
  }

  const status: DeviceStatus = device.isConnected ? 'connected' : 'disconnected';
  
  const statusData = {
    deviceId: device.id,
    status,
    lastSeen: device.updatedAt,
    brightness: device.brightness,
    firmwareVersion: device.firmwareVersion,
    buttonCount: device.buttonCount,
  };

  const response = createSuccessResponse(
    statusData,
    'Device status retrieved',
    req.requestId
  );

  res.status(200).json(response);
}));

export default router;