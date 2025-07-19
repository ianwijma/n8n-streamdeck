import { StreamDeckTrigger } from '../nodes/StreamDeckTrigger/StreamDeckTrigger.node';
import { StreamDeckApiService } from '../services/StreamDeckApiService';
import {
  ILoadOptionsFunctions,
  ITriggerFunctions,
  IWebhookFunctions,
  ICredentialDataDecryptedObject,
  INode,
  INodeExecutionData,
  NodeOperationError,
} from 'n8n-workflow';

// Mock the StreamDeckApiService
jest.mock('../services/StreamDeckApiService');

describe('StreamDeckTrigger', () => {
  let streamDeckTrigger: StreamDeckTrigger;
  let mockApiService: jest.Mocked<StreamDeckApiService>;
  let mockCredentials: ICredentialDataDecryptedObject;
  let mockNode: INode;

  beforeEach(() => {
    streamDeckTrigger = new StreamDeckTrigger();
    mockCredentials = {
      serverUrl: 'http://localhost:3001',
      apiKey: 'test-api-key',
      timeout: 5000,
    };
    mockNode = {
      id: 'test-node-id',
      name: 'Test StreamDeck Trigger',
      type: 'streamDeckTrigger',
      typeVersion: 1,
      position: [0, 0],
      parameters: {},
    };

    // Create mock API service instance
    mockApiService = {
      getMachines: jest.fn(),
      getDevices: jest.fn(),
      getButtons: jest.fn(),
      getDevice: jest.fn(),
      getButton: jest.fn(),
      registerWebhook: jest.fn(),
      unregisterWebhook: jest.fn(),
      validateWebhookPayload: jest.fn(),
      transformButtonPressEvent: jest.fn(),
      testConnection: jest.fn(),
    } as any;

    (
      StreamDeckApiService as jest.MockedClass<typeof StreamDeckApiService>
    ).mockImplementation(() => mockApiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('loadOptions', () => {
    describe('loadMachines', () => {
      it('should load machines successfully', async () => {
        const mockMachines = [
          {
            id: 'machine-1',
            name: 'Test Machine',
            hostname: 'localhost',
            platform: 'linux',
            status: 'online' as const,
          },
          {
            id: 'machine-2',
            name: 'Remote Machine',
            hostname: 'remote.example.com',
            platform: 'windows',
            status: 'offline' as const,
          },
        ];

        mockApiService.getMachines.mockResolvedValue(mockMachines);

        const mockLoadOptionsFunctions: Partial<ILoadOptionsFunctions> = {
          getCredentials: jest.fn().mockResolvedValue(mockCredentials),
          getNode: jest.fn().mockReturnValue(mockNode),
        };

        const result =
          await streamDeckTrigger.methods!.loadOptions!.loadMachines!.call(
            mockLoadOptionsFunctions as ILoadOptionsFunctions
          );

        expect(result).toEqual([
          {
            name: 'Test Machine (localhost)',
            value: 'machine-1',
            description: 'linux - online',
          },
          {
            name: 'Remote Machine (remote.example.com)',
            value: 'machine-2',
            description: 'windows - offline',
          },
        ]);

        expect(mockApiService.getMachines).toHaveBeenCalledTimes(1);
      });

      it('should handle API errors gracefully', async () => {
        mockApiService.getMachines.mockRejectedValue(
          new Error('API connection failed')
        );

        const mockLoadOptionsFunctions: Partial<ILoadOptionsFunctions> = {
          getCredentials: jest.fn().mockResolvedValue(mockCredentials),
          getNode: jest.fn().mockReturnValue(mockNode),
        };

        await expect(
          streamDeckTrigger.methods!.loadOptions!.loadMachines!.call(
            mockLoadOptionsFunctions as ILoadOptionsFunctions
          )
        ).rejects.toThrow(NodeOperationError);
      });
    });

    describe('loadDevices', () => {
      it('should load devices for a machine', async () => {
        const mockDevices = [
          {
            id: 'device-1',
            name: 'StreamDeck MK.2',
            model: 'Stream Deck MK.2',
            serialNumber: 'SD123456',
            connected: true,
            buttonCount: 15,
            columns: 5,
            rows: 3,
            firmwareVersion: '1.0.0',
          },
        ];

        mockApiService.getDevices.mockResolvedValue(mockDevices);

        const mockLoadOptionsFunctions: Partial<ILoadOptionsFunctions> = {
          getCredentials: jest.fn().mockResolvedValue(mockCredentials),
          getNode: jest.fn().mockReturnValue(mockNode),
          getCurrentNodeParameter: jest.fn().mockReturnValue('machine-1'),
        };

        const result =
          await streamDeckTrigger.methods!.loadOptions!.loadDevices!.call(
            mockLoadOptionsFunctions as ILoadOptionsFunctions
          );

        expect(result).toEqual([
          {
            name: 'StreamDeck MK.2 (Stream Deck MK.2)',
            value: 'device-1',
            description: 'SD123456 - 15 buttons - Connected',
          },
        ]);

        expect(mockApiService.getDevices).toHaveBeenCalledWith('machine-1');
      });

      it('should return empty array when no machine is selected', async () => {
        const mockLoadOptionsFunctions: Partial<ILoadOptionsFunctions> = {
          getCredentials: jest.fn().mockResolvedValue(mockCredentials),
          getNode: jest.fn().mockReturnValue(mockNode),
          getCurrentNodeParameter: jest.fn().mockReturnValue(''),
        };

        const result =
          await streamDeckTrigger.methods!.loadOptions!.loadDevices!.call(
            mockLoadOptionsFunctions as ILoadOptionsFunctions
          );

        expect(result).toEqual([]);
        expect(mockApiService.getDevices).not.toHaveBeenCalled();
      });
    });

    describe('loadButtons', () => {
      it('should load buttons for a device', async () => {
        const mockButtons = [
          {
            id: 'button-1',
            deviceId: 'device-1',
            position: 0,
            title: 'Test Button',
            enabled: true,
          },
          {
            id: 'button-2',
            deviceId: 'device-1',
            position: 2,
            title: 'Another Button',
            enabled: false,
          },
        ];

        const mockDevice = {
          id: 'device-1',
          name: 'StreamDeck MK.2',
          model: 'Stream Deck MK.2',
          serialNumber: 'SD123456',
          connected: true,
          buttonCount: 15,
          columns: 5,
          rows: 3,
          firmwareVersion: '1.0.0',
        };

        mockApiService.getButtons.mockResolvedValue(mockButtons);
        mockApiService.getDevice.mockResolvedValue(mockDevice);

        const mockLoadOptionsFunctions: Partial<ILoadOptionsFunctions> = {
          getCredentials: jest.fn().mockResolvedValue(mockCredentials),
          getNode: jest.fn().mockReturnValue(mockNode),
          getCurrentNodeParameter: jest.fn().mockReturnValue('device-1'),
        };

        const result =
          await streamDeckTrigger.methods!.loadOptions!.loadButtons!.call(
            mockLoadOptionsFunctions as ILoadOptionsFunctions
          );

        expect(result).toHaveLength(16); // Any button + 2 configured + 13 empty positions
        expect(result[0]).toEqual({
          name: 'Any Button',
          value: '*',
          description: 'Trigger on any button press',
        });
        expect(result[1]).toEqual({
          name: 'Test Button',
          value: 'button-1',
          description: 'Position 1 - Test Button',
        });
        expect(result[2]).toEqual({
          name: 'Another Button',
          value: 'button-2',
          description: 'Position 3 (disabled) - Another Button',
        });

        expect(mockApiService.getButtons).toHaveBeenCalledWith('device-1');
        expect(mockApiService.getDevice).toHaveBeenCalledWith('device-1');
      });
    });
  });

  describe('webhook functionality', () => {
    it('should process valid webhook payload', async () => {
      const mockWebhookPayload = {
        event: 'pressed',
        deviceId: 'device-1',
        buttonId: 'button-1',
        position: 0,
        timestamp: '2024-01-15T10:30:00.000Z',
      };

      const mockTransformedEvent = {
        event: 'pressed' as const,
        deviceId: 'device-1',
        buttonId: 'button-1',
        position: 0,
        timestamp: '2024-01-15T10:30:00.000Z',
      };

      mockApiService.validateWebhookPayload.mockReturnValue(true);
      mockApiService.transformButtonPressEvent.mockReturnValue(
        mockTransformedEvent
      );

      const mockTriggerFunctions: Partial<ITriggerFunctions> = {
        getNodeParameter: jest.fn().mockImplementation((paramName: string) => {
          switch (paramName) {
            case 'machine':
              return 'machine-1';
            case 'device':
              return 'device-1';
            case 'button':
              return 'button-1';
            case 'buttonEvents':
              return ['pressed'];
            case 'includeButtonData':
              return true;
            case 'includeDeviceData':
              return false;
            case 'includeMachineData':
              return false;
            case 'autoRegisterWebhook':
              return false;
            default:
              return undefined;
          }
        }),
        getCredentials: jest.fn().mockResolvedValue(mockCredentials),
        getNode: jest
          .fn()
          .mockReturnValue({ id: 'test-node', name: 'Test Node' }),
        emit: jest.fn(),
      };

      const mockWebhookFunctions: Partial<IWebhookFunctions> = {
        getBodyData: jest.fn().mockReturnValue(mockWebhookPayload),
        getQueryData: jest.fn().mockReturnValue({}),
        getHeaderData: jest.fn().mockReturnValue({}),
        getNodeParameter: jest
          .fn()
          .mockImplementation((parameterName: string) => {
            switch (parameterName) {
              case 'machine':
                return 'machine-1';
              case 'device':
                return 'device-1';
              case 'button':
                return 'button-1';
              case 'buttonEvents':
                return ['pressed'];
              case 'includeButtonData':
                return true;
              case 'includeDeviceData':
                return false;
              case 'includeMachineData':
                return false;
              default:
                return undefined;
            }
          }),
        getCredentials: jest.fn().mockResolvedValue(mockCredentials),
        getNode: jest
          .fn()
          .mockReturnValue({ id: 'test-node', name: 'Test Node' }),
      };

      // Get the trigger response
      const triggerResponse = await streamDeckTrigger.trigger.call(
        mockTriggerFunctions as ITriggerFunctions
      );

      // Call the webhook function directly on the node
      const webhookResult = await streamDeckTrigger.webhook!.call(
        mockWebhookFunctions as IWebhookFunctions
      );

      expect(webhookResult.workflowData).toBeDefined();
      expect(webhookResult.workflowData![0][0].json).toMatchObject({
        event: 'pressed',
        deviceId: 'device-1',
        buttonId: 'button-1',
        position: 0,
        machine: 'machine-1',
      });

      expect(mockApiService.validateWebhookPayload).toHaveBeenCalledWith(
        mockWebhookPayload
      );
      expect(mockApiService.transformButtonPressEvent).toHaveBeenCalledWith(
        mockWebhookPayload
      );
    });

    it('should filter out unwanted events', async () => {
      const mockWebhookPayload = {
        event: 'released',
        deviceId: 'device-1',
        buttonId: 'button-1',
        position: 0,
        timestamp: '2024-01-15T10:30:00.000Z',
      };

      const mockTransformedEvent = {
        event: 'released' as const,
        deviceId: 'device-1',
        buttonId: 'button-1',
        position: 0,
        timestamp: '2024-01-15T10:30:00.000Z',
      };

      mockApiService.validateWebhookPayload.mockReturnValue(true);
      mockApiService.transformButtonPressEvent.mockReturnValue(
        mockTransformedEvent
      );

      const mockTriggerFunctions: Partial<ITriggerFunctions> = {
        getNodeParameter: jest.fn().mockImplementation((paramName: string) => {
          switch (paramName) {
            case 'buttonEvents':
              return ['pressed']; // Only pressed events
            default:
              return 'test-value';
          }
        }),
        getCredentials: jest.fn().mockResolvedValue(mockCredentials),
        getNode: jest
          .fn()
          .mockReturnValue({ id: 'test-node', name: 'Test Node' }),
        emit: jest.fn(),
      };

      const mockWebhookFunctions: Partial<IWebhookFunctions> = {
        getBodyData: jest.fn().mockReturnValue(mockWebhookPayload),
        getQueryData: jest.fn().mockReturnValue({}),
        getHeaderData: jest.fn().mockReturnValue({}),
        getNodeParameter: jest
          .fn()
          .mockImplementation((parameterName: string) => {
            switch (parameterName) {
              case 'machine':
                return 'machine-1';
              case 'device':
                return 'device-1';
              case 'button':
                return 'button-1';
              case 'buttonEvents':
                return ['pressed'];
              case 'includeButtonData':
                return true;
              case 'includeDeviceData':
                return false;
              case 'includeMachineData':
                return false;
              default:
                return undefined;
            }
          }),
        getCredentials: jest.fn().mockResolvedValue(mockCredentials),
        getNode: jest
          .fn()
          .mockReturnValue({ id: 'test-node', name: 'Test Node' }),
      };

      const triggerResponse = await streamDeckTrigger.trigger.call(
        mockTriggerFunctions as ITriggerFunctions
      );

      const webhookResult = await streamDeckTrigger.webhook!.call(
        mockWebhookFunctions as IWebhookFunctions
      );

      expect(webhookResult.noWebhookResponse).toBe(true);
    });

    it('should handle invalid webhook payload', async () => {
      const mockWebhookPayload = {
        invalid: 'payload',
      };

      mockApiService.validateWebhookPayload.mockReturnValue(false);

      const mockTriggerFunctions: Partial<ITriggerFunctions> = {
        getNodeParameter: jest.fn().mockReturnValue('test-value'),
        getCredentials: jest.fn().mockResolvedValue(mockCredentials),
        getNode: jest
          .fn()
          .mockReturnValue({ id: 'test-node', name: 'Test Node' }),
        emit: jest.fn(),
      };

      const mockWebhookFunctions: Partial<IWebhookFunctions> = {
        getBodyData: jest.fn().mockReturnValue(mockWebhookPayload),
        getQueryData: jest.fn().mockReturnValue({}),
        getHeaderData: jest.fn().mockReturnValue({}),
        getNodeParameter: jest
          .fn()
          .mockImplementation((parameterName: string) => {
            switch (parameterName) {
              case 'machine':
                return 'machine-1';
              case 'device':
                return 'device-1';
              case 'button':
                return 'button-1';
              case 'buttonEvents':
                return ['pressed'];
              case 'includeButtonData':
                return true;
              case 'includeDeviceData':
                return false;
              case 'includeMachineData':
                return false;
              default:
                return undefined;
            }
          }),
        getCredentials: jest.fn().mockResolvedValue(mockCredentials),
        getNode: jest
          .fn()
          .mockReturnValue({ id: 'test-node', name: 'Test Node' }),
      };

      const triggerResponse = await streamDeckTrigger.trigger.call(
        mockTriggerFunctions as ITriggerFunctions
      );

      const webhookResult = await streamDeckTrigger.webhook!.call(
        mockWebhookFunctions as IWebhookFunctions
      );

      expect(webhookResult.noWebhookResponse).toBe(true);
      expect(mockApiService.validateWebhookPayload).toHaveBeenCalledWith(
        mockWebhookPayload
      );
    });
  });

  describe('manual trigger', () => {
    it('should execute manual trigger successfully', async () => {
      const mockTriggerFunctions: Partial<ITriggerFunctions> = {
        getNodeParameter: jest.fn().mockImplementation((paramName: string) => {
          switch (paramName) {
            case 'machine':
              return 'machine-1';
            case 'device':
              return 'device-1';
            case 'button':
              return 'button-1';
            case 'buttonEvents':
              return ['pressed'];
            case 'includeButtonData':
              return true;
            case 'includeDeviceData':
              return false;
            case 'includeMachineData':
              return false;
            case 'autoRegisterWebhook':
              return false;
            default:
              return undefined;
          }
        }),
        getCredentials: jest.fn().mockResolvedValue(mockCredentials),
        getNode: jest
          .fn()
          .mockReturnValue({ id: 'test-node', name: 'Test Node' }),
        emit: jest.fn(),
      };

      const mockButton = {
        id: 'button-1',
        deviceId: 'device-1',
        position: 0,
        title: 'Test Button',
        enabled: true,
      };

      mockApiService.getButton.mockResolvedValue(mockButton);

      const triggerResponse = await streamDeckTrigger.trigger.call(
        mockTriggerFunctions as ITriggerFunctions
      );

      await triggerResponse.manualTriggerFunction!();

      expect(mockTriggerFunctions.emit).toHaveBeenCalledWith([
        [
          {
            json: expect.objectContaining({
              event: 'manual_trigger',
              deviceId: 'device-1',
              buttonId: 'button-1',
              machine: 'machine-1',
              isManualTrigger: true,
              button: mockButton,
            }),
          },
        ],
      ]);
    });
  });

  describe('trigger response', () => {
    it('should return valid trigger response', async () => {
      const mockTriggerFunctions: Partial<ITriggerFunctions> = {
        getNodeParameter: jest
          .fn()
          .mockImplementation((parameterName: string) => {
            switch (parameterName) {
              case 'machine':
                return 'machine-1';
              case 'device':
                return 'device-1';
              case 'button':
                return 'button-1';
              case 'buttonEvents':
                return ['pressed'];
              case 'includeButtonData':
                return true;
              case 'includeDeviceData':
                return false;
              case 'includeMachineData':
                return false;
              default:
                return undefined;
            }
          }),
        getCredentials: jest.fn().mockResolvedValue(mockCredentials),
        getNode: jest
          .fn()
          .mockReturnValue({ id: 'test-node', name: 'Test Node' }),
        emit: jest.fn(),
      };

      const triggerResponse = await streamDeckTrigger.trigger.call(
        mockTriggerFunctions as ITriggerFunctions
      );

      expect(triggerResponse).toBeDefined();
      expect(triggerResponse.manualTriggerFunction).toBeDefined();
      expect(typeof triggerResponse.manualTriggerFunction).toBe('function');
    });

    it('should handle trigger initialization without errors', async () => {
      const mockTriggerFunctions: Partial<ITriggerFunctions> = {
        getNodeParameter: jest
          .fn()
          .mockImplementation((parameterName: string) => {
            switch (parameterName) {
              case 'machine':
                return 'machine-1';
              case 'device':
                return 'device-1';
              case 'button':
                return 'button-1';
              case 'buttonEvents':
                return ['pressed'];
              case 'includeButtonData':
                return true;
              case 'includeDeviceData':
                return false;
              case 'includeMachineData':
                return false;
              default:
                return undefined;
            }
          }),
        getCredentials: jest.fn().mockResolvedValue(mockCredentials),
        getNode: jest
          .fn()
          .mockReturnValue({ id: 'test-node', name: 'Test Node' }),
        emit: jest.fn(),
      };

      await expect(
        streamDeckTrigger.trigger.call(
          mockTriggerFunctions as ITriggerFunctions
        )
      ).resolves.toBeDefined();
    });
  });
});
