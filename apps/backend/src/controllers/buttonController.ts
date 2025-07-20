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
  generateUUID,
} from '@n8n-streamdeck/shared';
import { StreamDeckService } from '../services/streamDeckService';
import { WebhookService } from '../services/webhookService';
import { config } from '../config/environment';

const logger = new Logger({ level: config.logLevel }, 'ButtonController');

// In-memory button storage for demo purposes
// In a real application, this would be stored in a database
const buttonStorage = new Map<string, Button[]>();

export class ButtonController {
  private streamDeckService: StreamDeckService;
  private webhookService: WebhookService;

  constructor(streamDeckService: StreamDeckService) {
    this.streamDeckService = streamDeckService;
    this.webhookService = WebhookService.getInstance();
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
      let buttons = buttonStorage.get(deviceId);
      if (!buttons) {
        buttons = this.createDefaultButtons(deviceId, device.buttonCount);
        buttonStorage.set(deviceId, buttons);
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

      const response = createSuccessResponse(
        paginatedButtons,
        `Found ${paginatedButtons.length} buttons for device`,
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
        index,
        label,
        icon,
        action,
        backgroundColor,
        textColor,
        fontSize,
        isEnabled = true,
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

      if (typeof index !== 'number' || index < 0) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Button index must be a non-negative number',
          },
          req.requestId
        );
        res.status(HttpStatusCode.BAD_REQUEST).json(errorResponse);
        return;
      }

      logger.info('Creating/updating button', {
        requestId: req.requestId,
        deviceId,
        index,
        label,
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

      // Validate button index
      if (index >= device.buttonCount) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.INVALID_BUTTON_INDEX,
            message: `Button index ${index} is out of range for device (max: ${device.buttonCount - 1})`,
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

      // Get or create buttons array for device
      let buttons = buttonStorage.get(deviceId);
      if (!buttons) {
        buttons = this.createDefaultButtons(deviceId, device.buttonCount);
        buttonStorage.set(deviceId, buttons);
      }

      // Find existing button or create new one
      let button = buttons.find((b) => b.index === index);
      const isNewButton = !button;

      if (isNewButton) {
        button = {
          id: `btn-${deviceId}-${index}-${generateUUID()}`,
          deviceId,
          index,
          isEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        buttons.push(button);
      }

      // Update button properties
      if (label !== undefined) button!.label = label;
      if (icon !== undefined) button!.icon = icon;
      if (action !== undefined) button!.action = action;
      if (backgroundColor !== undefined)
        button!.backgroundColor = backgroundColor;
      if (textColor !== undefined) button!.textColor = textColor;
      if (fontSize !== undefined) button!.fontSize = fontSize;
      if (isEnabled !== undefined) button!.isEnabled = isEnabled;
      button!.updatedAt = new Date();

      // Sort buttons by index
      buttons.sort((a, b) => a.index - b.index);

      const response = createSuccessResponse(
        button,
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

      // Get buttons for device
      const buttons = buttonStorage.get(deviceId);
      if (!buttons) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.NOT_FOUND,
            message: 'No buttons found for device',
          },
          req.requestId
        );
        res.status(HttpStatusCode.NOT_FOUND).json(errorResponse);
        return;
      }

      // Find button
      const button = buttons.find((b) => b.id === buttonId);
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
        button,
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

      // Get buttons for device
      const buttons = buttonStorage.get(deviceId);
      if (!buttons) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.NOT_FOUND,
            message: 'No buttons found for device',
          },
          req.requestId
        );
        res.status(HttpStatusCode.NOT_FOUND).json(errorResponse);
        return;
      }

      // Find button index
      const buttonIndex = buttons.findIndex((b) => b.id === buttonId);
      if (buttonIndex === -1) {
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

      // Remove button (reset to default)
      const button = buttons[buttonIndex];
      const defaultButton = this.createDefaultButton(deviceId, button.index);
      buttons[buttonIndex] = defaultButton;

      const response = createSuccessResponse(
        defaultButton,
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

      // Get button
      const buttons = buttonStorage.get(deviceId);
      const button = buttons?.find((b) => b.id === buttonId);

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

      // Execute button action
      const result = await this.executeButtonAction(button);

      const response = createSuccessResponse(
        {
          buttonId: button.id,
          index: button.index,
          action: button.action,
          result,
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
   * Create default buttons for a device
   */
  private createDefaultButtons(
    deviceId: string,
    buttonCount: number
  ): Button[] {
    const buttons: Button[] = [];

    for (let i = 0; i < buttonCount; i++) {
      buttons.push(this.createDefaultButton(deviceId, i));
    }

    return buttons;
  }

  /**
   * Create a default button
   */
  private createDefaultButton(deviceId: string, index: number): Button {
    return {
      id: `btn-${deviceId}-${index}-${generateUUID()}`,
      deviceId,
      index,
      label: `Button ${index + 1}`,
      isEnabled: true,
      backgroundColor: '#000000',
      textColor: '#ffffff',
      fontSize: 12,
      createdAt: new Date(),
      updatedAt: new Date(),
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

  /**
   * Execute button action
   */
  private async executeButtonAction(button: Button): Promise<any> {
    if (!button.action) {
      return { message: 'No action configured' };
    }

    logger.info('Executing button action', {
      buttonId: button.id,
      actionType: button.action.type,
    });

    switch (button.action.type) {
      case ButtonActionType.TRIGGER_WORKFLOW:
        return this.executeWorkflowTrigger(button.action);
      case ButtonActionType.WEBHOOK:
        return this.executeWebhook(button.action);
      case ButtonActionType.HOTKEY:
        return this.executeHotkey(button.action);
      case ButtonActionType.COMMAND:
        return this.executeCommand(button.action);
      default:
        return {
          message: `Action type '${button.action.type}' not implemented`,
        };
    }
  }

  private async executeWorkflowTrigger(action: ButtonAction): Promise<any> {
    // TODO: Implement n8n workflow trigger
    return {
      message: 'Workflow trigger executed',
      workflowId: action.n8nWorkflowId,
      payload: action.payload,
    };
  }

  private async executeWebhook(action: ButtonAction): Promise<any> {
    // TODO: Implement webhook call
    return {
      message: 'Webhook executed',
      url: action.webhookUrl,
      payload: action.payload,
    };
  }

  private async executeHotkey(action: ButtonAction): Promise<any> {
    // TODO: Implement hotkey simulation
    return {
      message: 'Hotkey executed',
      keys: action.hotkey,
    };
  }

  private async executeCommand(action: ButtonAction): Promise<any> {
    // TODO: Implement command execution
    return {
      message: 'Command executed',
      command: action.command,
    };
  }
}
