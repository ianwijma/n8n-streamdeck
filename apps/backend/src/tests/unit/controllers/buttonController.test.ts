import { ButtonController } from '../../../controllers/buttonController';
import { StreamDeckService } from '../../../services/streamDeckService';
import {
  createMockRequest,
  createMockResponse,
  createMockDevice,
  createMockButton,
} from '../../utils/testHelpers';
import {
  HttpStatusCode,
  ApiErrorCode,
  ButtonActionType,
} from '@n8n-streamdeck/shared';

// Mock the StreamDeck module
jest.mock('@elgato-stream-deck/node');

describe('ButtonController', () => {
  let controller: ButtonController;
  let mockStreamDeckService: jest.Mocked<StreamDeckService>;
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(() => {
    // Create mock service
    mockStreamDeckService = {
      discoverDevices: jest.fn(),
      connectToDevice: jest.fn(),
      disconnectDevice: jest.fn(),
      getDevice: jest.fn(),
      isDeviceConnected: jest.fn(),
      getConnectedDevices: jest.fn(),
      setButtonImage: jest.fn(),
      shutdown: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
      removeAllListeners: jest.fn(),
    } as any;

    controller = new ButtonController(mockStreamDeckService);
    mockRequest = createMockRequest();
    mockResponse = createMockResponse();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listButtons', () => {
    it('should return paginated list of buttons for device', async () => {
      const mockDevice = createMockDevice({ id: 'device-1', buttonCount: 15 });
      mockStreamDeckService.getDevice.mockReturnValue(mockDevice);

      mockRequest.params = { deviceId: 'device-1' };
      mockRequest.query = { page: '1', limit: '10' };

      await controller.listButtons(mockRequest, mockResponse);

      expect(mockStreamDeckService.getDevice).toHaveBeenCalledWith('device-1');
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatusCode.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Array),
          pagination: expect.objectContaining({
            page: 1,
            limit: 10,
          }),
        })
      );
    });

    it('should return 404 for non-existent device', async () => {
      mockStreamDeckService.getDevice.mockReturnValue(undefined);
      mockRequest.params = { deviceId: 'non-existent' };

      await controller.listButtons(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatusCode.NOT_FOUND
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.NOT_FOUND,
            message: "Device with ID 'non-existent' not found",
          }),
        })
      );
    });

    it('should return 400 for missing device ID', async () => {
      mockRequest.params = {};

      await controller.listButtons(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatusCode.BAD_REQUEST
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Device ID is required',
          }),
        })
      );
    });
  });

  describe('createOrUpdateButton', () => {
    it('should create new button successfully', async () => {
      const mockDevice = createMockDevice({ id: 'device-1', buttonCount: 15 });
      mockStreamDeckService.getDevice.mockReturnValue(mockDevice);

      mockRequest.params = { deviceId: 'device-1' };
      mockRequest.body = {
        index: 0,
        label: 'Test Button',
        backgroundColor: '#FF0000',
        textColor: '#FFFFFF',
        fontSize: 12,
      };

      await controller.createOrUpdateButton(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatusCode.CREATED);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            index: 0,
            label: 'Test Button',
            backgroundColor: '#FF0000',
          }),
          message: 'Button created successfully',
        })
      );
    });

    it('should return 400 for invalid button index', async () => {
      const mockDevice = createMockDevice({ id: 'device-1', buttonCount: 15 });
      mockStreamDeckService.getDevice.mockReturnValue(mockDevice);

      mockRequest.params = { deviceId: 'device-1' };
      mockRequest.body = { index: 20 }; // Out of range

      await controller.createOrUpdateButton(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatusCode.BAD_REQUEST
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.INVALID_BUTTON_INDEX,
            message: 'Button index 20 is out of range for device (max: 14)',
          }),
        })
      );
    });

    it('should return 400 for invalid action configuration', async () => {
      const mockDevice = createMockDevice({ id: 'device-1', buttonCount: 15 });
      mockStreamDeckService.getDevice.mockReturnValue(mockDevice);

      mockRequest.params = { deviceId: 'device-1' };
      mockRequest.body = {
        index: 0,
        action: {
          type: ButtonActionType.TRIGGER_WORKFLOW,
          // Missing required n8nWorkflowId
        },
      };

      await controller.createOrUpdateButton(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatusCode.BAD_REQUEST
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Invalid button action configuration',
          }),
        })
      );
    });

    it('should update existing button successfully', async () => {
      const mockDevice = createMockDevice({ id: 'device-1', buttonCount: 15 });
      mockStreamDeckService.getDevice.mockReturnValue(mockDevice);

      // Mock existing button in storage
      const existingButton = createMockButton('device-1', 0, {
        label: 'Old Label',
      });
      const buttonStorage = (controller as any).buttonStorage || new Map();
      buttonStorage.set('device-1', [existingButton]);

      mockRequest.params = { deviceId: 'device-1' };
      mockRequest.body = {
        index: 0,
        label: 'Updated Label',
      };

      await controller.createOrUpdateButton(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatusCode.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Button updated successfully',
        })
      );
    });
  });

  describe('getButton', () => {
    it('should return button by ID', async () => {
      const mockDevice = createMockDevice({ id: 'device-1' });
      const mockButton = createMockButton('device-1', 0);

      mockStreamDeckService.getDevice.mockReturnValue(mockDevice);

      // Mock button storage
      const buttonStorage = new Map();
      buttonStorage.set('device-1', [mockButton]);
      (controller as any).buttonStorage = buttonStorage;

      mockRequest.params = { deviceId: 'device-1', buttonId: mockButton.id };

      await controller.getButton(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatusCode.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ id: mockButton.id }),
        })
      );
    });

    it('should return 404 for non-existent button', async () => {
      const mockDevice = createMockDevice({ id: 'device-1' });
      mockStreamDeckService.getDevice.mockReturnValue(mockDevice);

      // Mock empty button storage
      const buttonStorage = new Map();
      buttonStorage.set('device-1', []);
      (controller as any).buttonStorage = buttonStorage;

      mockRequest.params = { deviceId: 'device-1', buttonId: 'non-existent' };

      await controller.getButton(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatusCode.NOT_FOUND
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.NOT_FOUND,
            message: "Button with ID 'non-existent' not found",
          }),
        })
      );
    });
  });

  describe('deleteButton', () => {
    it('should reset button to default successfully', async () => {
      const mockDevice = createMockDevice({ id: 'device-1' });
      const mockButton = createMockButton('device-1', 0);

      mockStreamDeckService.getDevice.mockReturnValue(mockDevice);

      // Mock button storage
      const buttonStorage = new Map();
      buttonStorage.set('device-1', [mockButton]);
      (controller as any).buttonStorage = buttonStorage;

      mockRequest.params = { deviceId: 'device-1', buttonId: mockButton.id };

      await controller.deleteButton(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatusCode.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Button reset to default successfully',
        })
      );
    });
  });

  describe('pressButton', () => {
    it('should simulate button press successfully', async () => {
      const mockDevice = createMockDevice({
        id: 'device-1',
        isConnected: true,
      });
      const mockButton = createMockButton('device-1', 0, {
        isEnabled: true,
        action: {
          type: ButtonActionType.TRIGGER_WORKFLOW,
          payload: { workflowId: 'test-workflow' },
          n8nWorkflowId: 'test-workflow',
        },
      });

      mockStreamDeckService.getDevice.mockReturnValue(mockDevice);
      mockStreamDeckService.isDeviceConnected.mockReturnValue(true);

      // Mock button storage
      const buttonStorage = new Map();
      buttonStorage.set('device-1', [mockButton]);
      (controller as any).buttonStorage = buttonStorage;

      mockRequest.params = { deviceId: 'device-1', buttonId: mockButton.id };

      await controller.pressButton(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatusCode.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            buttonId: mockButton.id,
            index: 0,
            result: expect.any(Object),
          }),
          message: 'Button pressed successfully',
        })
      );
    });

    it('should return 400 for disconnected device', async () => {
      const mockDevice = createMockDevice({
        id: 'device-1',
        isConnected: false,
      });
      const mockButton = createMockButton('device-1', 0);

      mockStreamDeckService.getDevice.mockReturnValue(mockDevice);
      mockStreamDeckService.isDeviceConnected.mockReturnValue(false);

      mockRequest.params = { deviceId: 'device-1', buttonId: mockButton.id };

      await controller.pressButton(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatusCode.BAD_REQUEST
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.DEVICE_NOT_CONNECTED,
            message: 'Device is not connected',
          }),
        })
      );
    });

    it('should return 400 for disabled button', async () => {
      const mockDevice = createMockDevice({
        id: 'device-1',
        isConnected: true,
      });
      const mockButton = createMockButton('device-1', 0, { isEnabled: false });

      mockStreamDeckService.getDevice.mockReturnValue(mockDevice);
      mockStreamDeckService.isDeviceConnected.mockReturnValue(true);

      // Mock button storage
      const buttonStorage = new Map();
      buttonStorage.set('device-1', [mockButton]);
      (controller as any).buttonStorage = buttonStorage;

      mockRequest.params = { deviceId: 'device-1', buttonId: mockButton.id };

      await controller.pressButton(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatusCode.BAD_REQUEST
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Button is disabled',
          }),
        })
      );
    });
  });

  describe('button action validation', () => {
    it('should validate workflow trigger action', () => {
      const validAction = {
        type: ButtonActionType.TRIGGER_WORKFLOW,
        payload: { workflowId: 'test-workflow' },
        n8nWorkflowId: 'test-workflow',
      };

      const isValid = (controller as any).isValidButtonAction(validAction);
      expect(isValid).toBe(true);
    });

    it('should validate webhook action', () => {
      const validAction = {
        type: ButtonActionType.WEBHOOK,
        payload: { url: 'https://example.com/webhook' },
        webhookUrl: 'https://example.com/webhook',
      };

      const isValid = (controller as any).isValidButtonAction(validAction);
      expect(isValid).toBe(true);
    });

    it('should validate hotkey action', () => {
      const validAction = {
        type: ButtonActionType.HOTKEY,
        payload: { keys: ['ctrl', 'c'] },
        hotkey: ['ctrl', 'c'],
      };

      const isValid = (controller as any).isValidButtonAction(validAction);
      expect(isValid).toBe(true);
    });

    it('should validate command action', () => {
      const validAction = {
        type: ButtonActionType.COMMAND,
        payload: { command: 'echo "hello"' },
        command: 'echo "hello"',
      };

      const isValid = (controller as any).isValidButtonAction(validAction);
      expect(isValid).toBe(true);
    });

    it('should reject invalid action types', () => {
      const invalidAction = {
        type: 'invalid-type' as any,
        payload: {},
      };

      const isValid = (controller as any).isValidButtonAction(invalidAction);
      expect(isValid).toBe(false);
    });

    it('should reject workflow action without workflowId', () => {
      const invalidAction = {
        type: ButtonActionType.TRIGGER_WORKFLOW,
        payload: {},
        // Missing n8nWorkflowId
      };

      const isValid = (controller as any).isValidButtonAction(invalidAction);
      expect(isValid).toBe(false);
    });
  });
});
