import { Request, Response } from 'express';
import {
  createSuccessResponse,
  createErrorResponse,
  ApiErrorCode,
  HttpStatusCode,
  Logger,
  Device,
  DeviceStatus,
  getDeviceLayout,
} from '@n8n-streamdeck/shared';
import { StreamDeckService } from '../services/streamDeckService';
import { config } from '../config/environment';

const logger = new Logger({ level: config.logLevel }, 'DeviceController');

/**
 * Transform device data to include layout information for frontend
 */
function transformDeviceForApi(device: Device) {
  const layout = getDeviceLayout(device.type);
  return {
    ...device,
    connected: device.isConnected,
    columns: layout.columns,
    rows: layout.rows,
    createdAt: device.createdAt.toISOString(),
    updatedAt: device.updatedAt.toISOString(),
  };
}

export class DeviceController {
  private streamDeckService: StreamDeckService;

  constructor(streamDeckService: StreamDeckService) {
    this.streamDeckService = streamDeckService;
  }

  /**
   * GET /devices - List all connected devices
   */
  async listDevices(req: Request, res: Response): Promise<void> {
    try {
      const {
        includeDisconnected = 'true',
        page = '1',
        limit = '10',
      } = req.query;

      logger.info('Fetching devices list', {
        requestId: req.requestId,
        includeDisconnected,
        page,
        limit,
      });

      // Discover devices first to get the latest state
      await this.streamDeckService.discoverDevices();

      // Get all devices from the service
      let devices = this.streamDeckService.getDevices();

      // Transform devices to match frontend API expectations
      const transformedDevices = devices.map(transformDeviceForApi);

      // Filter disconnected devices if requested
      let filteredDevices = transformedDevices;
      if (includeDisconnected === 'false') {
        filteredDevices = transformedDevices.filter(
          (device) => device.connected
        );
      }

      // Pagination
      const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
      const limitNum = Math.max(
        1,
        Math.min(100, parseInt(limit as string, 10) || 10)
      );
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;
      const paginatedDevices = filteredDevices.slice(startIndex, endIndex);

      const response = createSuccessResponse(
        paginatedDevices,
        `Found ${paginatedDevices.length} devices`,
        req.requestId
      );

      // Add pagination metadata
      (response as any).pagination = {
        page: pageNum,
        limit: limitNum,
        total: filteredDevices.length,
        totalPages: Math.ceil(filteredDevices.length / limitNum),
        hasNext: endIndex < filteredDevices.length,
        hasPrev: pageNum > 1,
      };

      res.status(HttpStatusCode.OK).json(response);
    } catch (error) {
      logger.error('Failed to list devices', error as Error, {
        requestId: req.requestId,
      });

      const errorResponse = createErrorResponse(
        {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: 'Failed to retrieve devices',
          details: { error: (error as Error).message },
        },
        req.requestId
      );

      res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * GET /devices/:id - Get specific device details
   */
  async getDevice(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Device ID is required',
          },
          req.requestId
        );
        res.status(HttpStatusCode.BAD_REQUEST).json(errorResponse);
        return;
      }

      logger.info('Fetching device by ID', {
        requestId: req.requestId,
        deviceId: id,
      });

      const device = this.streamDeckService.getDevice(id);

      if (!device) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.NOT_FOUND,
            message: `Device with ID '${id}' not found`,
          },
          req.requestId
        );
        res.status(HttpStatusCode.NOT_FOUND).json(errorResponse);
        return;
      }

      // Transform device to match frontend API expectations
      const transformedDevice = transformDeviceForApi(device);

      const response = createSuccessResponse(
        transformedDevice,
        'Device found',
        req.requestId
      );

      res.status(HttpStatusCode.OK).json(response);
    } catch (error) {
      logger.error('Failed to get device', error as Error, {
        requestId: req.requestId,
        deviceId: req.params.id,
      });

      const errorResponse = createErrorResponse(
        {
          code: ApiErrorCode.DEVICE_NOT_CONNECTED,
          message: 'Failed to connect to device',
          details: { error: (error as Error).message },
        },
        req.requestId
      );

      res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * POST /devices/:id/connect - Connect to device
   */
  async connectDevice(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Device ID is required',
          },
          req.requestId
        );
        res.status(HttpStatusCode.BAD_REQUEST).json(errorResponse);
        return;
      }

      logger.info('Connecting to device', {
        requestId: req.requestId,
        deviceId: id,
      });

      // Check if device exists
      const device = this.streamDeckService.getDevice(id);
      if (!device) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.NOT_FOUND,
            message: `Device with ID '${id}' not found`,
          },
          req.requestId
        );
        res.status(HttpStatusCode.NOT_FOUND).json(errorResponse);
        return;
      }

      // Check if already connected
      if (this.streamDeckService.isDeviceConnected(id)) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.CONFLICT,
            message: 'Device is already connected',
          },
          req.requestId
        );
        res.status(HttpStatusCode.CONFLICT).json(errorResponse);
        return;
      }

      // Connect to device
      await this.streamDeckService.connectToDevice(id);

      // Get updated device info
      const updatedDevice = this.streamDeckService.getDevice(id);

      // Transform device to match frontend API expectations
      const transformedDevice = updatedDevice
        ? transformDeviceForApi(updatedDevice)
        : null;

      const response = createSuccessResponse(
        transformedDevice,
        'Device connected successfully',
        req.requestId
      );

      res.status(HttpStatusCode.OK).json(response);
    } catch (error) {
      logger.error('Failed to connect device', error as Error, {
        requestId: req.requestId,
        deviceId: req.params.id,
      });

      const errorResponse = createErrorResponse(
        {
          code: ApiErrorCode.DEVICE_NOT_CONNECTED,
          message: 'Failed to connect to device',
          details: { error: (error as Error).message },
        },
        req.requestId
      );

      res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * DELETE /devices/:id - Disconnect device
   */
  async disconnectDevice(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Device ID is required',
          },
          req.requestId
        );
        res.status(HttpStatusCode.BAD_REQUEST).json(errorResponse);
        return;
      }

      logger.info('Disconnecting device', {
        requestId: req.requestId,
        deviceId: id,
      });

      // Check if device exists
      const device = this.streamDeckService.getDevice(id);
      if (!device) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.NOT_FOUND,
            message: `Device with ID '${id}' not found`,
          },
          req.requestId
        );
        res.status(HttpStatusCode.NOT_FOUND).json(errorResponse);
        return;
      }

      // Check if already disconnected
      if (!this.streamDeckService.isDeviceConnected(id)) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.CONFLICT,
            message: 'Device is already disconnected',
          },
          req.requestId
        );
        res.status(HttpStatusCode.CONFLICT).json(errorResponse);
        return;
      }

      // Disconnect device
      await this.streamDeckService.disconnectDevice(id);

      // Get updated device info
      const updatedDevice = this.streamDeckService.getDevice(id);

      // Transform device to match frontend API expectations
      const transformedDevice = updatedDevice
        ? transformDeviceForApi(updatedDevice)
        : null;

      const response = createSuccessResponse(
        transformedDevice,
        'Device disconnected successfully',
        req.requestId
      );

      res.status(HttpStatusCode.OK).json(response);
    } catch (error) {
      logger.error('Failed to disconnect device', error as Error, {
        requestId: req.requestId,
        deviceId: req.params.id,
      });

      const errorResponse = createErrorResponse(
        {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: 'Failed to disconnect device',
          details: { error: (error as Error).message },
        },
        req.requestId
      );

      res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * GET /devices/:id/status - Get device status
   */
  async getDeviceStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Device ID is required',
          },
          req.requestId
        );
        res.status(HttpStatusCode.BAD_REQUEST).json(errorResponse);
        return;
      }

      logger.info('Fetching device status', {
        requestId: req.requestId,
        deviceId: id,
      });

      const device = this.streamDeckService.getDevice(id);

      if (!device) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.NOT_FOUND,
            message: `Device with ID '${id}' not found`,
          },
          req.requestId
        );
        res.status(HttpStatusCode.NOT_FOUND).json(errorResponse);
        return;
      }

      const status: DeviceStatus = device.isConnected
        ? 'connected'
        : 'disconnected';

      const statusData = {
        deviceId: device.id,
        status,
        lastSeen: device.updatedAt,
        brightness: device.brightness,
        firmwareVersion: device.firmwareVersion,
        buttonCount: device.buttonCount,
        name: device.name,
        type: device.type,
        serialNumber: device.serialNumber,
      };

      const response = createSuccessResponse(
        statusData,
        'Device status retrieved',
        req.requestId
      );

      res.status(HttpStatusCode.OK).json(response);
    } catch (error) {
      logger.error('Failed to get device status', error as Error, {
        requestId: req.requestId,
        deviceId: req.params.id,
      });

      const errorResponse = createErrorResponse(
        {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: 'Failed to retrieve device status',
          details: { error: (error as Error).message },
        },
        req.requestId
      );

      res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * PUT /devices/:id/brightness - Update device brightness
   */
  async updateBrightness(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { brightness } = req.body;

      if (!id) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Device ID is required',
          },
          req.requestId
        );
        res.status(HttpStatusCode.BAD_REQUEST).json(errorResponse);
        return;
      }

      if (
        typeof brightness !== 'number' ||
        brightness < 0 ||
        brightness > 100
      ) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Brightness must be a number between 0 and 100',
          },
          req.requestId
        );
        res.status(HttpStatusCode.BAD_REQUEST).json(errorResponse);
        return;
      }

      logger.info('Updating device brightness', {
        requestId: req.requestId,
        deviceId: id,
        brightness,
      });

      const device = this.streamDeckService.getDevice(id);

      if (!device) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.NOT_FOUND,
            message: `Device with ID '${id}' not found`,
          },
          req.requestId
        );
        res.status(HttpStatusCode.NOT_FOUND).json(errorResponse);
        return;
      }

      if (!this.streamDeckService.isDeviceConnected(id)) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.DEVICE_NOT_CONNECTED,
            message: 'Cannot update brightness of disconnected device',
          },
          req.requestId
        );
        res.status(HttpStatusCode.BAD_REQUEST).json(errorResponse);
        return;
      }

      // Update brightness in device info
      device.brightness = brightness;
      device.updatedAt = new Date();

      // TODO: Update actual device brightness via StreamDeck API
      // This would require extending the StreamDeckService with a setBrightness method

      const response = createSuccessResponse(
        device,
        'Device brightness updated successfully',
        req.requestId
      );

      res.status(HttpStatusCode.OK).json(response);
    } catch (error) {
      logger.error('Failed to update device brightness', error as Error, {
        requestId: req.requestId,
        deviceId: req.params.id,
      });

      const errorResponse = createErrorResponse(
        {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: 'Failed to update device brightness',
          details: { error: (error as Error).message },
        },
        req.requestId
      );

      res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }
}
