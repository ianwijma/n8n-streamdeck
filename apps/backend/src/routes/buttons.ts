import { Router, Request, Response } from 'express';
import { 
  createSuccessResponse,
  Button,
  ButtonAction,
  ButtonActionType,
  Logger,
  generateUUID
} from '@n8n-streamdeck/shared';
import { config } from '../config/environment';
import { asyncHandler, createNotFoundError, createValidationError } from '../middleware/errorHandler';

const router = Router();
const logger = new Logger({ level: config.logLevel }, 'ButtonsRoute');

// Mock data for development
const mockButtons: Button[] = [
  {
    id: 'btn-' + generateUUID(),
    deviceId: 'dev-123',
    index: 0,
    label: 'Deploy Workflow',
    icon: 'deploy.png',
    action: {
      type: ButtonActionType.TRIGGER_WORKFLOW,
      payload: { workflowId: 'workflow-123' },
      n8nWorkflowId: 'workflow-123',
    },
    isEnabled: true,
    backgroundColor: '#4CAF50',
    textColor: '#FFFFFF',
    fontSize: 12,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date(),
  },
  {
    id: 'btn-' + generateUUID(),
    deviceId: 'dev-123',
    index: 1,
    label: 'Send Alert',
    icon: 'alert.png',
    action: {
      type: ButtonActionType.WEBHOOK,
      payload: { url: 'https://api.example.com/alert' },
      webhookUrl: 'https://api.example.com/alert',
    },
    isEnabled: true,
    backgroundColor: '#FF9800',
    textColor: '#FFFFFF',
    fontSize: 12,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date(),
  },
];

// GET /api/buttons - List all buttons
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { deviceId, enabled = 'true' } = req.query;
  
  logger.info('Fetching buttons list', {
    requestId: req.requestId,
    deviceId,
    enabled,
  });

  let buttons = [...mockButtons];
  
  // Filter by device ID if provided
  if (deviceId) {
    buttons = buttons.filter(button => button.deviceId === deviceId);
  }
  
  // Filter by enabled status if requested
  if (enabled === 'true') {
    buttons = buttons.filter(button => button.isEnabled);
  }

  const response = createSuccessResponse(
    buttons,
    `Found ${buttons.length} buttons`,
    req.requestId
  );

  res.status(200).json(response);
}));

// GET /api/buttons/:id - Get button by ID
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  logger.info('Fetching button by ID', {
    requestId: req.requestId,
    buttonId: id,
  });

  const button = mockButtons.find(b => b.id === id);
  
  if (!button) {
    throw createNotFoundError('Button', id);
  }

  const response = createSuccessResponse(
    button,
    'Button found',
    req.requestId
  );

  res.status(200).json(response);
}));

// PUT /api/buttons/:id - Update button
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;
  
  logger.info('Updating button', {
    requestId: req.requestId,
    buttonId: id,
    updateData,
  });

  const buttonIndex = mockButtons.findIndex(b => b.id === id);
  
  if (buttonIndex === -1) {
    throw createNotFoundError('Button', id);
  }

  // Validate update data
  if (updateData.backgroundColor && !/^#[0-9A-F]{6}$/i.test(updateData.backgroundColor)) {
    throw createValidationError('backgroundColor must be a valid hex color');
  }
  
  if (updateData.textColor && !/^#[0-9A-F]{6}$/i.test(updateData.textColor)) {
    throw createValidationError('textColor must be a valid hex color');
  }
  
  if (updateData.fontSize && (typeof updateData.fontSize !== 'number' || updateData.fontSize < 8 || updateData.fontSize > 24)) {
    throw createValidationError('fontSize must be a number between 8 and 24');
  }

  // Update button
  const updatedButton = {
    ...mockButtons[buttonIndex],
    ...updateData,
    updatedAt: new Date(),
  };
  
  mockButtons[buttonIndex] = updatedButton;

  const response = createSuccessResponse(
    updatedButton,
    'Button updated successfully',
    req.requestId
  );

  res.status(200).json(response);
}));

// POST /api/buttons/:id/press - Simulate button press
router.post('/:id/press', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { pressType = 'short' } = req.body;
  
  logger.info('Simulating button press', {
    requestId: req.requestId,
    buttonId: id,
    pressType,
  });

  const button = mockButtons.find(b => b.id === id);
  
  if (!button) {
    throw createNotFoundError('Button', id);
  }

  if (!button.isEnabled) {
    throw createValidationError('Button is disabled');
  }

  // Simulate button press action
  let actionResult = {};
  
  if (button.action) {
    switch (button.action.type) {
      case ButtonActionType.TRIGGER_WORKFLOW:
        actionResult = {
          type: 'workflow_triggered',
          workflowId: button.action.n8nWorkflowId,
          executionId: 'exec-' + generateUUID(),
        };
        break;
        
      case ButtonActionType.WEBHOOK:
        actionResult = {
          type: 'webhook_called',
          url: button.action.webhookUrl,
          status: 'success',
        };
        break;
        
      case ButtonActionType.HOTKEY:
        actionResult = {
          type: 'hotkey_pressed',
          keys: button.action.hotkey,
        };
        break;
        
      case ButtonActionType.COMMAND:
        actionResult = {
          type: 'command_executed',
          command: button.action.command,
          exitCode: 0,
        };
        break;
        
      default:
        actionResult = {
          type: 'no_action',
          message: 'No action configured for this button',
        };
    }
  }

  const pressResult = {
    buttonId: button.id,
    buttonLabel: button.label,
    pressType,
    timestamp: new Date().toISOString(),
    action: actionResult,
  };

  const response = createSuccessResponse(
    pressResult,
    'Button press simulated successfully',
    req.requestId
  );

  res.status(200).json(response);
}));

// PUT /api/buttons/:id/enable - Enable button
router.put('/:id/enable', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  logger.info('Enabling button', {
    requestId: req.requestId,
    buttonId: id,
  });

  const buttonIndex = mockButtons.findIndex(b => b.id === id);
  
  if (buttonIndex === -1) {
    throw createNotFoundError('Button', id);
  }

  mockButtons[buttonIndex].isEnabled = true;
  mockButtons[buttonIndex].updatedAt = new Date();

  const response = createSuccessResponse(
    mockButtons[buttonIndex],
    'Button enabled successfully',
    req.requestId
  );

  res.status(200).json(response);
}));

// PUT /api/buttons/:id/disable - Disable button
router.put('/:id/disable', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  logger.info('Disabling button', {
    requestId: req.requestId,
    buttonId: id,
  });

  const buttonIndex = mockButtons.findIndex(b => b.id === id);
  
  if (buttonIndex === -1) {
    throw createNotFoundError('Button', id);
  }

  mockButtons[buttonIndex].isEnabled = false;
  mockButtons[buttonIndex].updatedAt = new Date();

  const response = createSuccessResponse(
    mockButtons[buttonIndex],
    'Button disabled successfully',
    req.requestId
  );

  res.status(200).json(response);
}));

// GET /api/buttons/device/:deviceId - Get buttons for specific device
router.get('/device/:deviceId', asyncHandler(async (req: Request, res: Response) => {
  const { deviceId } = req.params;
  
  logger.info('Fetching buttons for device', {
    requestId: req.requestId,
    deviceId,
  });

  const buttons = mockButtons.filter(button => button.deviceId === deviceId);

  const response = createSuccessResponse(
    buttons,
    `Found ${buttons.length} buttons for device ${deviceId}`,
    req.requestId
  );

  res.status(200).json(response);
}));

export default router;