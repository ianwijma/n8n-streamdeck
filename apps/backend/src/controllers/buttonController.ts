import { Request, Response } from 'express';
import {
  createSuccessResponse,
  createErrorResponse,
  ApiErrorCode,
  HttpStatusCode,
  Logger,
  Button,
  ButtonAction,
  ButtonActionType,
} from '@n8n-streamdeck/shared';
import { StreamDeckService } from '../services/streamDeckService';
import { WebhookService } from '../services/webhookService';
import { ButtonSyncService } from '../services/buttonSyncService';
import { ButtonRepository } from '../services/repositories/buttonRepository';
import { DeviceRepository } from '../services/repositories/deviceRepository';
import { DeviceType } from '../../generated/prisma';
import { config } from '../config/environment';

const logger = new Logger({ level: config.logLevel }, 'ButtonController');

export class ButtonController {
  private streamDeckService: StreamDeckService;
  private webhookService: WebhookService;
  private syncService: ButtonSyncService;
  private buttonRepository: ButtonRepository;
  private deviceRepository: DeviceRepository;

  constructor(streamDeckService: StreamDeckService) {
    this.streamDeckService = streamDeckService;
    this.webhookService = WebhookService.getInstance();
    this.syncService = ButtonSyncService.getInstance();
    this.buttonRepository = new ButtonRepository();
    this.deviceRepository = new DeviceRepository();

    // Listen for device connection events to initialize buttons
    this.streamDeckService.on(
      'deviceConnected',
      this.handleDeviceConnected.bind(this)
    );
  }

  /**
   * Handle device connection events to initialize buttons
   */
  private async handleDeviceConnected(event: any): Promise<void> {
    try {
      const deviceId = event.device?.id || event.device?.deviceId;
      if (!deviceId) {
        logger.warn('Device connected event missing device ID', {
          event,
        });
        return;
      }
      logger.info('Device connected, initializing buttons', { deviceId });

      // Ensure device exists in database
      const actualDeviceId = await this.ensureDeviceInDatabase(deviceId);
      if (!actualDeviceId) {
        logger.error(
          'Failed to ensure device exists in database',
          new Error('Device not found'),
          {
            deviceId,
          }
        );
        return;
      }

      // Get current button configurations for this device from database
      const buttons =
        await this.buttonRepository.findByDeviceId(actualDeviceId);
      if (buttons && buttons.length > 0) {
        // Convert database buttons to shared Button format
        const sharedButtons = buttons.map((button) =>
          this.convertToSharedButton(button)
        );
        await this.syncService.initializeDeviceButtons(deviceId, sharedButtons);
      } else {
        logger.info('No button configurations found for device', { deviceId });
      }
    } catch (error) {
      logger.error(
        'Failed to initialize buttons on device connection',
        error as Error
      );
    }
  }

  /**
   * Ensure device exists in database, create if missing
   */
  private async ensureDeviceInDatabase(
    deviceId: string
  ): Promise<string | null> {
    try {
      // Get device from StreamDeckService first
      const memoryDevice = this.streamDeckService.getDevice(deviceId);
      if (!memoryDevice) {
        return null;
      }

      const serialNumber = memoryDevice.serialNumber || deviceId;

      // Use upsert to handle existing devices gracefully
      const device = await this.deviceRepository.upsert({
        id: deviceId,
        name: memoryDevice.name,
        type: this.mapDeviceType(memoryDevice.type),
        serialNumber,
        buttonCount: memoryDevice.buttonCount,
        firmwareVersion: memoryDevice.firmwareVersion,
        brightness: memoryDevice.brightness,
      });

      logger.info('Ensured device exists in database', {
        deviceId,
        serialNumber,
        actualDeviceId: device.id,
      });
      return device.id;
    } catch (error) {
      logger.error('Failed to ensure device in database', error as Error, {
        deviceId,
      });
      return null;
    }
  }

  /**
   * Map device type string to DeviceType enum
   */
  private mapDeviceType(deviceType: string): DeviceType {
    const typeMap: Record<string, DeviceType> = {
      'streamdeck-original': DeviceType.STREAMDECK_ORIGINAL,
      'streamdeck-mini': DeviceType.STREAMDECK_MINI,
      'streamdeck-xl': DeviceType.STREAMDECK_XL,
      'streamdeck-mk2': DeviceType.STREAMDECK_MK2,
      'streamdeck-plus': DeviceType.STREAMDECK_PLUS,
    };
    return typeMap[deviceType] || DeviceType.STREAMDECK_ORIGINAL;
  }

  /**
   * Convert database button to shared Button format
   */
  private convertToSharedButton(dbButton: any): Button {
    return {
      id: dbButton.id,
      deviceId: dbButton.deviceId,
      index: dbButton.index,
      label: dbButton.label || undefined,
      icon: dbButton.icon || undefined,
      action: dbButton.actionType
        ? {
            type: dbButton.actionType,
            payload: dbButton.actionPayload
              ? JSON.parse(dbButton.actionPayload)
              : {},
            n8nWorkflowId: dbButton.n8nWorkflowId || undefined,
            webhookUrl: dbButton.webhookUrl || undefined,
            command: dbButton.command || undefined,
            hotkey: dbButton.hotkey ? JSON.parse(dbButton.hotkey) : undefined,
          }
        : undefined,
      isEnabled: dbButton.isEnabled,
      backgroundColor: dbButton.backgroundColor || undefined,
      textColor: dbButton.textColor || undefined,
      fontSize: dbButton.fontSize || undefined,
      createdAt: dbButton.createdAt,
      updatedAt: dbButton.updatedAt,
    };
  }

  /**
   * GET /devices/:deviceId/buttons - List all buttons for device
   */
  async listButtons(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId } = req.params;
      const { page = '1', limit = '50' } = req.query;

      if (!deviceId) {
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

      logger.info('Fetching buttons for device', {
        requestId: req.requestId,
        deviceId,
        page,
        limit,
      });

      // Check if device exists in memory
      const device = this.streamDeckService.getDevice(deviceId);
      if (!device) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.NOT_FOUND,
            message: `Device with ID '${deviceId}' not found`,
          },
          req.requestId
        );
        res.status(HttpStatusCode.NOT_FOUND).json(errorResponse);
        return;
      }

      // Ensure device exists in database
      const actualDeviceId = await this.ensureDeviceInDatabase(deviceId);
      if (!actualDeviceId) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.INTERNAL_ERROR,
            message: 'Failed to register device in database',
          },
          req.requestId
        );
        res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json(errorResponse);
        return;
      }

      // Get buttons for device or create default ones
      let buttons = await this.buttonRepository.findByDeviceId(actualDeviceId);
      if (!buttons || buttons.length === 0) {
        buttons = await this.buttonRepository.createDefaultButtons(
          actualDeviceId,
          device.buttonCount
        );
      }

      // Pagination
      const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
      const limitNum = Math.max(
        1,
        Math.min(100, parseInt(limit as string, 10) || 50)
      );
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;
      const paginatedButtons = buttons.slice(startIndex, endIndex);

      const transformedButtons = paginatedButtons.map((button) =>
        this.transformButtonToResponse(button)
      );

      const response = createSuccessResponse(
        transformedButtons,
        `Found ${transformedButtons.length} buttons for device`,
        req.requestId
      );

      // Add pagination metadata
      (response as any).pagination = {
        page: pageNum,
        limit: limitNum,
        total: buttons.length,
        totalPages: Math.ceil(buttons.length / limitNum),
        hasNext: endIndex < buttons.length,
        hasPrev: pageNum > 1,
      };

      res.status(HttpStatusCode.OK).json(response);
    } catch (error) {
      logger.error('Failed to list buttons', error as Error, {
        requestId: req.requestId,
        deviceId: req.params.deviceId,
      });

      const errorResponse = createErrorResponse(
        {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: 'Failed to retrieve buttons',
          details: { error: (error as Error).message },
        },
        req.requestId
      );

      res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * POST /devices/:deviceId/buttons - Create/update button configuration
   */
  async createOrUpdateButton(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId } = req.params;
      const {
        position,
        title,
        icon,
        action,
        backgroundColor,
        textColor,
        fontSize,
        enabled = true,
      } = req.body;

      if (!deviceId) {
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

      if (typeof position !== 'number' || position < 0) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Button position must be a non-negative number',
          },
          req.requestId
        );
        res.status(HttpStatusCode.BAD_REQUEST).json(errorResponse);
        return;
      }

      logger.info('Creating/updating button', {
        requestId: req.requestId,
        deviceId,
        position,
        title,
      });

      // Check if device exists in memory
      const device = this.streamDeckService.getDevice(deviceId);
      if (!device) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.NOT_FOUND,
            message: `Device with ID '${deviceId}' not found`,
          },
          req.requestId
        );
        res.status(HttpStatusCode.NOT_FOUND).json(errorResponse);
        return;
      }

      // Ensure device exists in database
      const actualDeviceId = await this.ensureDeviceInDatabase(deviceId);
      if (!actualDeviceId) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.INTERNAL_ERROR,
            message: 'Failed to register device in database',
          },
          req.requestId
        );
        res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json(errorResponse);
        return;
      }

      // Validate button position
      if (position >= device.buttonCount) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.INVALID_BUTTON_INDEX,
            message: `Button position ${position} is out of range for device (max: ${device.buttonCount - 1})`,
          },
          req.requestId
        );
        res.status(HttpStatusCode.BAD_REQUEST).json(errorResponse);
        return;
      }

      // Validate action if provided
      if (action && !this.isValidButtonAction(action)) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Invalid button action configuration',
          },
          req.requestId
        );
        res.status(HttpStatusCode.BAD_REQUEST).json(errorResponse);
        return;
      }

      // Find existing button or create new one
      let button = await this.buttonRepository.findByDeviceAndIndex(
        actualDeviceId,
        position
      );
      const isNewButton = !button;

      if (isNewButton) {
        // Create new button in database
        button = await this.buttonRepository.create({
          deviceId: actualDeviceId,
          index: position,
          label: title,
          icon,
          actionType: action?.type,
          actionPayload: action ? JSON.stringify(action) : undefined,
          n8nWorkflowId: action?.n8nWorkflowId,
          webhookUrl: action?.webhookUrl,
          command: action?.command,
          hotkey: action?.hotkey ? JSON.stringify(action.hotkey) : undefined,
          isEnabled: enabled,
          backgroundColor,
          textColor,
          fontSize,
        });
      } else {
        // Update existing button in database
        const updateData: any = {};
        if (title !== undefined) updateData.label = title;
        if (icon !== undefined) updateData.icon = icon;
        if (action !== undefined) {
          updateData.actionType = action.type;
          updateData.actionPayload = JSON.stringify(action);
          updateData.n8nWorkflowId = action.n8nWorkflowId;
          updateData.webhookUrl = action.webhookUrl;
          updateData.command = action.command;
          updateData.hotkey = action.hotkey
            ? JSON.stringify(action.hotkey)
            : undefined;
        }
        if (backgroundColor !== undefined)
          updateData.backgroundColor = backgroundColor;
        if (textColor !== undefined) updateData.textColor = textColor;
        if (fontSize !== undefined) updateData.fontSize = fontSize;
        if (enabled !== undefined) updateData.isEnabled = enabled;

        button = await this.buttonRepository.update(button!.id, updateData);
      }

      // Update physical device
      if (button) {
        const sharedButton = this.convertToSharedButton(button);
        await this.updatePhysicalButton(deviceId, sharedButton);
      }

      const response = createSuccessResponse(
        this.transformButtonToResponse(button!),
        isNewButton
          ? 'Button created successfully'
          : 'Button updated successfully',
        req.requestId
      );

      res
        .status(isNewButton ? HttpStatusCode.CREATED : HttpStatusCode.OK)
        .json(response);
    } catch (error) {
      logger.error('Failed to create/update button', error as Error, {
        requestId: req.requestId,
        deviceId: req.params.deviceId,
      });

      const errorResponse = createErrorResponse(
        {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: 'Failed to create/update button',
          details: { error: (error as Error).message },
        },
        req.requestId
      );

      res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * PUT /devices/:deviceId/buttons/:buttonId - Update button configuration
   */
  async updateButton(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId, buttonId } = req.params;
      const {
        title,
        icon,
        action,
        backgroundColor,
        textColor,
        fontSize,
        enabled = true,
      } = req.body;

      if (!deviceId || !buttonId) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Device ID and Button ID are required',
          },
          req.requestId
        );
        res.status(HttpStatusCode.BAD_REQUEST).json(errorResponse);
        return;
      }

      logger.info('Updating button', {
        requestId: req.requestId,
        deviceId,
        buttonId,
        title,
      });

      // Check if device exists in memory
      const device = this.streamDeckService.getDevice(deviceId);
      if (!device) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.NOT_FOUND,
            message: `Device with ID '${deviceId}' not found`,
          },
          req.requestId
        );
        res.status(HttpStatusCode.NOT_FOUND).json(errorResponse);
        return;
      }

      // Ensure device exists in database
      const actualDeviceId = await this.ensureDeviceInDatabase(deviceId);
      if (!actualDeviceId) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.INTERNAL_ERROR,
            message: 'Failed to register device in database',
          },
          req.requestId
        );
        res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json(errorResponse);
        return;
      }

      // Find button in database
      const button = await this.buttonRepository.findById(buttonId);
      if (!button) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.NOT_FOUND,
            message: `Button with ID '${buttonId}' not found`,
          },
          req.requestId
        );
        res.status(HttpStatusCode.NOT_FOUND).json(errorResponse);
        return;
      }

      // Update button properties in database
      const updateData: any = {};
      if (title !== undefined) updateData.label = title;
      if (icon !== undefined) updateData.icon = icon;
      if (action !== undefined) {
        updateData.actionType = action.type;
        updateData.actionPayload = JSON.stringify(action);
        updateData.n8nWorkflowId = action.n8nWorkflowId;
        updateData.webhookUrl = action.webhookUrl;
        updateData.command = action.command;
        updateData.hotkey = action.hotkey
          ? JSON.stringify(action.hotkey)
          : undefined;
      }
      if (backgroundColor !== undefined)
        updateData.backgroundColor = backgroundColor;
      if (textColor !== undefined) updateData.textColor = textColor;
      if (fontSize !== undefined) updateData.fontSize = fontSize;
      if (enabled !== undefined) updateData.isEnabled = enabled;

      const updatedButton = await this.buttonRepository.update(
        button.id,
        updateData
      );

      // Update physical device
      const sharedButton = this.convertToSharedButton(updatedButton);
      await this.updatePhysicalButton(deviceId, sharedButton);

      const response = createSuccessResponse(
        this.transformButtonToResponse(updatedButton),
        'Button updated successfully',
        req.requestId
      );

      res.status(HttpStatusCode.OK).json(response);
    } catch (error) {
      logger.error('Failed to update button', error as Error, {
        requestId: req.requestId,
        deviceId: req.params.deviceId,
        buttonId: req.params.buttonId,
      });

      const errorResponse = createErrorResponse(
        {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: 'Failed to update button',
          details: { error: (error as Error).message },
        },
        req.requestId
      );

      res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * GET /devices/:deviceId/buttons/:buttonId - Get button details
   */
  async getButton(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId, buttonId } = req.params;

      if (!deviceId || !buttonId) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Device ID and Button ID are required',
          },
          req.requestId
        );
        res.status(HttpStatusCode.BAD_REQUEST).json(errorResponse);
        return;
      }

      logger.info('Fetching button details', {
        requestId: req.requestId,
        deviceId,
        buttonId,
      });

      // Check if device exists in memory
      const device = this.streamDeckService.getDevice(deviceId);
      if (!device) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.NOT_FOUND,
            message: `Device with ID '${deviceId}' not found`,
          },
          req.requestId
        );
        res.status(HttpStatusCode.NOT_FOUND).json(errorResponse);
        return;
      }

      // Find button in database
      const button = await this.buttonRepository.findById(buttonId);
      if (!button) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.NOT_FOUND,
            message: `Button with ID '${buttonId}' not found`,
          },
          req.requestId
        );
        res.status(HttpStatusCode.NOT_FOUND).json(errorResponse);
        return;
      }

      const response = createSuccessResponse(
        this.transformButtonToResponse(button),
        'Button found',
        req.requestId
      );

      res.status(HttpStatusCode.OK).json(response);
    } catch (error) {
      logger.error('Failed to get button', error as Error, {
        requestId: req.requestId,
        deviceId: req.params.deviceId,
        buttonId: req.params.buttonId,
      });

      const errorResponse = createErrorResponse(
        {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: 'Failed to retrieve button',
          details: { error: (error as Error).message },
        },
        req.requestId
      );

      res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * DELETE /devices/:deviceId/buttons/:buttonId - Delete button
   */
  async deleteButton(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId, buttonId } = req.params;

      if (!deviceId || !buttonId) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Device ID and Button ID are required',
          },
          req.requestId
        );
        res.status(HttpStatusCode.BAD_REQUEST).json(errorResponse);
        return;
      }

      logger.info('Deleting button', {
        requestId: req.requestId,
        deviceId,
        buttonId,
      });

      // Check if device exists in memory
      const device = this.streamDeckService.getDevice(deviceId);
      if (!device) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.NOT_FOUND,
            message: `Device with ID '${deviceId}' not found`,
          },
          req.requestId
        );
        res.status(HttpStatusCode.NOT_FOUND).json(errorResponse);
        return;
      }

      // Find button in database
      const button = await this.buttonRepository.findById(buttonId);
      if (!button) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.NOT_FOUND,
            message: `Button with ID '${buttonId}' not found`,
          },
          req.requestId
        );
        res.status(HttpStatusCode.NOT_FOUND).json(errorResponse);
        return;
      }

      // Reset button to default (update in database)
      const defaultButton = await this.buttonRepository.update(button.id, {
        label: undefined,
        icon: undefined,
        actionType: undefined,
        actionPayload: undefined,
        n8nWorkflowId: undefined,
        webhookUrl: undefined,
        command: undefined,
        hotkey: undefined,
        backgroundColor: undefined,
        textColor: undefined,
        fontSize: undefined,
        isEnabled: true,
      });

      const response = createSuccessResponse(
        this.transformButtonToResponse(defaultButton),
        'Button reset to default successfully',
        req.requestId
      );

      res.status(HttpStatusCode.OK).json(response);
    } catch (error) {
      logger.error('Failed to delete button', error as Error, {
        requestId: req.requestId,
        deviceId: req.params.deviceId,
        buttonId: req.params.buttonId,
      });

      const errorResponse = createErrorResponse(
        {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: 'Failed to delete button',
          details: { error: (error as Error).message },
        },
        req.requestId
      );

      res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * POST /devices/:deviceId/buttons/:buttonId/press - Simulate button press
   */
  async pressButton(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId, buttonId } = req.params;

      if (!deviceId || !buttonId) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Device ID and Button ID are required',
          },
          req.requestId
        );
        res.status(HttpStatusCode.BAD_REQUEST).json(errorResponse);
        return;
      }

      logger.info('Simulating button press', {
        requestId: req.requestId,
        deviceId,
        buttonId,
      });

      // Check if device exists and is connected
      const device = this.streamDeckService.getDevice(deviceId);
      if (!device) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.NOT_FOUND,
            message: `Device with ID '${deviceId}' not found`,
          },
          req.requestId
        );
        res.status(HttpStatusCode.NOT_FOUND).json(errorResponse);
        return;
      }

      if (!this.streamDeckService.isDeviceConnected(deviceId)) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.DEVICE_NOT_CONNECTED,
            message: 'Device is not connected',
          },
          req.requestId
        );
        res.status(HttpStatusCode.BAD_REQUEST).json(errorResponse);
        return;
      }

      // Get button from database
      const button = await this.buttonRepository.findById(buttonId);

      if (!button) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.NOT_FOUND,
            message: `Button with ID '${buttonId}' not found`,
          },
          req.requestId
        );
        res.status(HttpStatusCode.NOT_FOUND).json(errorResponse);
        return;
      }

      if (!button.isEnabled) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Button is disabled',
          },
          req.requestId
        );
        res.status(HttpStatusCode.BAD_REQUEST).json(errorResponse);
        return;
      }

      // Send webhook event for button press
      const buttonPressEvent = {
        event: 'pressed' as const,
        deviceId,
        buttonId: button.id,
        position: button.index,
        timestamp: new Date().toISOString(),
        button: {
          id: button.id,
          deviceId: button.deviceId,
          position: button.index,
          title: button.label,
          enabled: button.isEnabled,
          backgroundColor: button.backgroundColor,
          textColor: button.textColor,
          fontSize: button.fontSize,
        },
        device: {
          id: device.id,
          name: device.name,
          model: device.type,
          connected: device.isConnected,
          buttonCount: device.buttonCount,
        },
      };

      // Send to webhooks (don't wait for completion)
      this.webhookService
        .sendButtonPressEvent(buttonPressEvent)
        .catch((error) => {
          logger.error('Failed to send webhook events', error as Error, {
            deviceId,
            buttonId: button.id,
          });
        });

      const response = createSuccessResponse(
        {
          buttonId: button.id,
          index: button.index,
          action: button.actionType
            ? {
                type: button.actionType,
                payload: button.actionPayload
                  ? JSON.parse(button.actionPayload)
                  : {},
              }
            : undefined,
        },
        'Button pressed successfully',
        req.requestId
      );

      res.status(HttpStatusCode.OK).json(response);
    } catch (error) {
      logger.error('Failed to press button', error as Error, {
        requestId: req.requestId,
        deviceId: req.params.deviceId,
        buttonId: req.params.buttonId,
      });

      const errorResponse = createErrorResponse(
        {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: 'Failed to execute button press',
          details: { error: (error as Error).message },
        },
        req.requestId
      );

      res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * Update the physical StreamDeck device with button configuration
   */
  private async updatePhysicalButton(
    deviceId: string,
    button: Button
  ): Promise<void> {
    try {
      await this.syncService.updatePhysicalButton(deviceId, button);
    } catch (error) {
      logger.error('Failed to update physical button', error as Error, {
        deviceId,
        buttonIndex: button.index,
        title: button.label,
      });
      // Don't throw the error - we don't want to fail the API call if physical update fails
    }
  }

  /**
   * Transform internal button format to API response format
   */
  private transformButtonToResponse(button: any): any {
    return {
      id: button.id,
      deviceId: button.deviceId,
      position: button.index,
      title: button.label,
      icon: button.icon,
      backgroundColor: button.backgroundColor,
      textColor: button.textColor,
      fontSize: button.fontSize,
      action: button.actionType
        ? {
            type: button.actionType,
            payload: button.actionPayload
              ? JSON.parse(button.actionPayload)
              : {},
            n8nWorkflowId: button.n8nWorkflowId,
            webhookUrl: button.webhookUrl,
            command: button.command,
            hotkey: button.hotkey ? JSON.parse(button.hotkey) : undefined,
          }
        : undefined,
      enabled: button.isEnabled,
      createdAt: button.createdAt.toISOString(),
      updatedAt: button.updatedAt.toISOString(),
    };
  }

  /**
   * POST /devices/:deviceId/buttons/:buttonId/move - Move button to new position
   */
  async moveButton(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId, buttonId } = req.params;
      const { position } = req.body;

      if (!deviceId || !buttonId) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Device ID and Button ID are required',
          },
          req.requestId
        );
        res.status(HttpStatusCode.BAD_REQUEST).json(errorResponse);
        return;
      }

      if (typeof position !== 'number' || position < 0) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Position must be a non-negative number',
          },
          req.requestId
        );
        res.status(HttpStatusCode.BAD_REQUEST).json(errorResponse);
        return;
      }

      logger.info('Moving button', {
        requestId: req.requestId,
        deviceId,
        buttonId,
        newPosition: position,
      });

      // Get the button to move
      const button = await this.buttonRepository.findById(buttonId);
      if (!button) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.NOT_FOUND,
            message: `Button with ID '${buttonId}' not found`,
          },
          req.requestId
        );
        res.status(HttpStatusCode.NOT_FOUND).json(errorResponse);
        return;
      }

      // Check if there's already a button at the target position
      const targetButton = await this.buttonRepository.findByDeviceAndIndex(
        deviceId,
        position
      );

      // If there's a button at the target position, we need to swap them
      if (targetButton) {
        // Update both buttons' positions
        await this.buttonRepository.update(button.id, { index: position });
        await this.buttonRepository.update(targetButton.id, {
          index: button.index,
        });
      } else {
        // Just move the button to the new position
        await this.buttonRepository.update(button.id, { index: position });
      }

      // Get the updated button
      const updatedButton = await this.buttonRepository.findById(buttonId);

      const response = createSuccessResponse(
        this.transformButtonToResponse(updatedButton!),
        'Button moved successfully',
        req.requestId
      );

      res.status(HttpStatusCode.OK).json(response);
    } catch (error) {
      logger.error('Failed to move button', error as Error, {
        requestId: req.requestId,
        deviceId: req.params.deviceId,
        buttonId: req.params.buttonId,
      });

      const errorResponse = createErrorResponse(
        {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: 'Failed to move button',
          details: { error: (error as Error).message },
        },
        req.requestId
      );

      res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * POST /devices/:deviceId/buttons/:buttonId/swap - Swap two buttons
   */
  async swapButtons(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId, buttonId } = req.params;
      const { targetButtonId } = req.body;

      if (!deviceId || !buttonId || !targetButtonId) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Device ID, Button ID, and Target Button ID are required',
          },
          req.requestId
        );
        res.status(HttpStatusCode.BAD_REQUEST).json(errorResponse);
        return;
      }

      logger.info('Swapping buttons', {
        requestId: req.requestId,
        deviceId,
        buttonId,
        targetButtonId,
      });

      // Get both buttons
      const button1 = await this.buttonRepository.findById(buttonId);
      const button2 = await this.buttonRepository.findById(targetButtonId);

      if (!button1) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.NOT_FOUND,
            message: `Button with ID '${buttonId}' not found`,
          },
          req.requestId
        );
        res.status(HttpStatusCode.NOT_FOUND).json(errorResponse);
        return;
      }

      if (!button2) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.NOT_FOUND,
            message: `Target button with ID '${targetButtonId}' not found`,
          },
          req.requestId
        );
        res.status(HttpStatusCode.NOT_FOUND).json(errorResponse);
        return;
      }

      // Swap the positions
      const tempIndex = button1.index;
      await this.buttonRepository.update(button1.id, { index: button2.index });
      await this.buttonRepository.update(button2.id, { index: tempIndex });

      // Get the updated buttons
      const updatedButton1 = await this.buttonRepository.findById(buttonId);
      const updatedButton2 =
        await this.buttonRepository.findById(targetButtonId);

      const response = createSuccessResponse(
        {
          button1: this.transformButtonToResponse(updatedButton1!),
          button2: this.transformButtonToResponse(updatedButton2!),
        },
        'Buttons swapped successfully',
        req.requestId
      );

      res.status(HttpStatusCode.OK).json(response);
    } catch (error) {
      logger.error('Failed to swap buttons', error as Error, {
        requestId: req.requestId,
        deviceId: req.params.deviceId,
        buttonId: req.params.buttonId,
      });

      const errorResponse = createErrorResponse(
        {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: 'Failed to swap buttons',
          details: { error: (error as Error).message },
        },
        req.requestId
      );

      res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * POST /devices/:deviceId/buttons/:buttonId/copy - Copy button to new position
   */
  async copyButton(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId, buttonId } = req.params;
      const { targetPosition } = req.body;

      if (!deviceId || !buttonId) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Device ID and Button ID are required',
          },
          req.requestId
        );
        res.status(HttpStatusCode.BAD_REQUEST).json(errorResponse);
        return;
      }

      if (typeof targetPosition !== 'number' || targetPosition < 0) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Target position must be a non-negative number',
          },
          req.requestId
        );
        res.status(HttpStatusCode.BAD_REQUEST).json(errorResponse);
        return;
      }

      logger.info('Copying button', {
        requestId: req.requestId,
        deviceId,
        buttonId,
        targetPosition,
      });

      // Get the source button
      const sourceButton = await this.buttonRepository.findById(buttonId);
      if (!sourceButton) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.NOT_FOUND,
            message: `Button with ID '${buttonId}' not found`,
          },
          req.requestId
        );
        res.status(HttpStatusCode.NOT_FOUND).json(errorResponse);
        return;
      }

      // Check if there's already a button at the target position
      const existingButton = await this.buttonRepository.findByDeviceAndIndex(
        deviceId,
        targetPosition
      );

      if (existingButton) {
        // Update the existing button with the source button's configuration
        const updatedButton = await this.buttonRepository.update(
          existingButton.id,
          {
            label: sourceButton.label || undefined,
            icon: sourceButton.icon || undefined,
            iconData: sourceButton.iconData
              ? Buffer.from(sourceButton.iconData)
              : undefined,
            actionType: sourceButton.actionType || undefined,
            actionPayload: sourceButton.actionPayload || undefined,
            n8nWorkflowId: sourceButton.n8nWorkflowId || undefined,
            webhookUrl: sourceButton.webhookUrl || undefined,
            command: sourceButton.command || undefined,
            hotkey: sourceButton.hotkey || undefined,
            isEnabled: sourceButton.isEnabled,
            backgroundColor: sourceButton.backgroundColor || undefined,
            textColor: sourceButton.textColor || undefined,
            fontSize: sourceButton.fontSize || undefined,
          }
        );

        const response = createSuccessResponse(
          this.transformButtonToResponse(updatedButton),
          'Button copied successfully',
          req.requestId
        );

        res.status(HttpStatusCode.OK).json(response);
      } else {
        // Create a new button at the target position
        const newButton = await this.buttonRepository.create({
          deviceId,
          index: targetPosition,
          label: sourceButton.label || undefined,
          icon: sourceButton.icon || undefined,
          iconData: sourceButton.iconData
            ? Buffer.from(sourceButton.iconData)
            : undefined,
          actionType: sourceButton.actionType || undefined,
          actionPayload: sourceButton.actionPayload || undefined,
          n8nWorkflowId: sourceButton.n8nWorkflowId || undefined,
          webhookUrl: sourceButton.webhookUrl || undefined,
          command: sourceButton.command || undefined,
          hotkey: sourceButton.hotkey || undefined,
          isEnabled: sourceButton.isEnabled,
          backgroundColor: sourceButton.backgroundColor || undefined,
          textColor: sourceButton.textColor || undefined,
          fontSize: sourceButton.fontSize || undefined,
        });

        const response = createSuccessResponse(
          this.transformButtonToResponse(newButton),
          'Button copied successfully',
          req.requestId
        );

        res.status(HttpStatusCode.CREATED).json(response);
      }
    } catch (error) {
      logger.error('Failed to copy button', error as Error, {
        requestId: req.requestId,
        deviceId: req.params.deviceId,
        buttonId: req.params.buttonId,
      });

      const errorResponse = createErrorResponse(
        {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: 'Failed to copy button',
          details: { error: (error as Error).message },
        },
        req.requestId
      );

      res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * DELETE /devices/:deviceId/buttons - Clear all buttons
   */
  async clearAllButtons(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId } = req.params;

      if (!deviceId) {
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

      logger.info('Clearing all buttons', {
        requestId: req.requestId,
        deviceId,
      });

      // Delete all buttons for the device
      const result = await this.buttonRepository.deleteByDeviceId(deviceId);

      const response = createSuccessResponse(
        { deletedCount: result.count },
        `Cleared ${result.count} buttons successfully`,
        req.requestId
      );

      res.status(HttpStatusCode.OK).json(response);
    } catch (error) {
      logger.error('Failed to clear all buttons', error as Error, {
        requestId: req.requestId,
        deviceId: req.params.deviceId,
      });

      const errorResponse = createErrorResponse(
        {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: 'Failed to clear all buttons',
          details: { error: (error as Error).message },
        },
        req.requestId
      );

      res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * Validate button action configuration
   */
  private isValidButtonAction(action: ButtonAction): boolean {
    if (!action || !action.type) {
      return false;
    }

    const validTypes = Object.values(ButtonActionType);
    if (!validTypes.includes(action.type)) {
      return false;
    }

    // Type-specific validation
    switch (action.type) {
      case ButtonActionType.TRIGGER_WORKFLOW:
        return !!action.n8nWorkflowId;
      case ButtonActionType.WEBHOOK:
        return !!action.webhookUrl;
      case ButtonActionType.HOTKEY:
        return Array.isArray(action.hotkey) && action.hotkey.length > 0;
      case ButtonActionType.COMMAND:
        return !!action.command;
      default:
        return true;
    }
  }
}
