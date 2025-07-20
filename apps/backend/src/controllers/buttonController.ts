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
import { config } from '../config/environment';

const logger = new Logger({ level: config.logLevel }, 'ButtonController');

export class ButtonController {
  private streamDeckService: StreamDeckService;
  private webhookService: WebhookService;
  private syncService: ButtonSyncService;
  private buttonRepository: ButtonRepository;

  constructor(streamDeckService: StreamDeckService) {
    this.streamDeckService = streamDeckService;
    this.webhookService = WebhookService.getInstance();
    this.syncService = ButtonSyncService.getInstance();
    this.buttonRepository = new ButtonRepository();

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

      // Get current button configurations for this device from database
      const buttons = await this.buttonRepository.findByDeviceId(deviceId);
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

      // Check if device exists
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

      // Get buttons for device or create default ones
      let buttons = await this.buttonRepository.findByDeviceId(deviceId);
      if (!buttons || buttons.length === 0) {
        buttons = await this.buttonRepository.createDefaultButtons(
          deviceId,
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

      // Check if device exists
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
        deviceId,
        position
      );
      const isNewButton = !button;

      if (isNewButton) {
        // Create new button in database
        button = await this.buttonRepository.create({
          deviceId,
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
