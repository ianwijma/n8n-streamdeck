import {
  IDataObject,
  ILoadOptionsFunctions,
  INodePropertyOptions,
  INodeType,
  INodeTypeDescription,
  ITriggerFunctions,
  ITriggerResponse,
  IWebhookFunctions,
  IWebhookResponseData,
  NodeConnectionType,
  NodeOperationError,
} from 'n8n-workflow';
import {
  StreamDeckApiService,
  StreamDeckMachine,
  StreamDeckDevice,
  StreamDeckButton,
  ButtonPressEvent,
} from '../../services/StreamDeckApiService';

async function createTestTriggerData(
  apiService: StreamDeckApiService,
  machine: string,
  deviceId: string,
  buttonId: string,
  includeButtonData: boolean,
  includeDeviceData: boolean,
  includeMachineData: boolean
): Promise<IDataObject> {
  const testData: IDataObject = {
    event: 'manual_trigger',
    deviceId,
    buttonId: buttonId === '*' ? 'test-button' : buttonId,
    position: 0,
    timestamp: new Date().toISOString(),
    machine,
    isManualTrigger: true,
  };

  try {
    // Add additional data if requested
    if (
      includeButtonData &&
      buttonId !== '*' &&
      !buttonId.startsWith('position:')
    ) {
      testData.button = await apiService.getButton(deviceId, buttonId);
    }

    if (includeDeviceData) {
      testData.device = await apiService.getDevice(deviceId);
    }

    if (includeMachineData) {
      const machines = await apiService.getMachines();
      testData.machineData = machines.find((m) => m.id === machine);
    }
  } catch (error) {
    // Don't fail manual trigger if additional data can't be loaded
    testData.dataLoadError =
      error instanceof Error ? error.message : 'Unknown error';
  }

  return testData;
}

async function buildOutputData(
  apiService: StreamDeckApiService,
  buttonEvent: ButtonPressEvent,
  machine: string,
  includeButtonData: boolean,
  includeDeviceData: boolean,
  includeMachineData: boolean,
  headers: IDataObject,
  query: IDataObject
): Promise<IDataObject> {
  const outputData: IDataObject = {
    // Core event data
    event: buttonEvent.event,
    deviceId: buttonEvent.deviceId,
    buttonId: buttonEvent.buttonId,
    position: buttonEvent.position,
    timestamp: buttonEvent.timestamp,
    machine,

    // Request metadata
    headers,
    query,

    // Processing metadata
    processedAt: new Date().toISOString(),
    nodeVersion: '1.0.0',
  };

  try {
    // Add button data if requested and available
    if (includeButtonData) {
      if (buttonEvent.button) {
        outputData.button = buttonEvent.button;
      } else if (buttonEvent.buttonId && buttonEvent.buttonId !== '*') {
        outputData.button = await apiService.getButton(
          buttonEvent.deviceId,
          buttonEvent.buttonId
        );
      }
    }

    // Add device data if requested
    if (includeDeviceData) {
      if (buttonEvent.device) {
        outputData.device = buttonEvent.device;
      } else {
        outputData.device = await apiService.getDevice(buttonEvent.deviceId);
      }
    }

    // Add machine data if requested
    if (includeMachineData) {
      if (buttonEvent.machine) {
        outputData.machineData = buttonEvent.machine;
      } else {
        const machines = await apiService.getMachines();
        outputData.machineData = machines.find((m) => m.id === machine);
      }
    }
  } catch (error) {
    // Don't fail the trigger if additional data can't be loaded
    outputData.dataLoadWarning =
      error instanceof Error ? error.message : 'Failed to load additional data';
  }

  return outputData;
}

export class StreamDeckTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'StreamDeck Trigger',
    name: 'streamDeckTrigger',
    icon: 'file:streamdeck.svg',
    group: ['trigger'],
    version: 1,
    description: 'Triggers workflows when StreamDeck buttons are pressed',
    subtitle:
      '={{$parameter["device"] && $parameter["button"] ? $parameter["device"] + " - " + $parameter["button"] : "StreamDeck Button"}}',
    defaults: {
      name: 'StreamDeck Trigger',
    },
    inputs: [],
    outputs: [NodeConnectionType.Main],
    credentials: [
      {
        name: 'streamDeckApi',
        required: true,
      },
    ],
    webhooks: [
      {
        name: 'default',
        httpMethod: 'POST',
        responseMode: 'onReceived',
        path: 'streamdeck',
      },
    ],
    properties: [
      {
        displayName: 'Machine',
        name: 'machine',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'loadMachines',
        },
        default: '',
        required: true,
        description: 'Select the machine/server hosting StreamDeck devices',
      },
      {
        displayName: 'Device',
        name: 'device',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'loadDevices',
          loadOptionsDependsOn: ['machine'],
        },
        default: '',
        required: true,
        description: 'Select the StreamDeck device',
      },
      {
        displayName: 'Button',
        name: 'button',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'loadButtons',
          loadOptionsDependsOn: ['device'],
        },
        default: '',
        required: true,
        description: 'Select the specific button to monitor',
      },
      {
        displayName: 'Button Events',
        name: 'buttonEvents',
        type: 'multiOptions',
        options: [
          {
            name: 'Button Pressed',
            value: 'pressed',
            description: 'Trigger when button is pressed down',
          },
          {
            name: 'Button Released',
            value: 'released',
            description: 'Trigger when button is released',
          },
        ],
        default: ['pressed'],
        description: 'Which button events should trigger the workflow',
      },
      {
        displayName: 'Include Button Data',
        name: 'includeButtonData',
        type: 'boolean',
        default: true,
        description:
          'Whether to include button configuration data in the output',
      },
      {
        displayName: 'Include Device Data',
        name: 'includeDeviceData',
        type: 'boolean',
        default: false,
        description: 'Whether to include device information in the output',
      },
      {
        displayName: 'Include Machine Data',
        name: 'includeMachineData',
        type: 'boolean',
        default: false,
        description: 'Whether to include machine information in the output',
      },
    ],
  };

  methods = {
    loadOptions: {
      async loadMachines(
        this: ILoadOptionsFunctions
      ): Promise<INodePropertyOptions[]> {
        try {
          const credentials = await this.getCredentials('streamDeckApi');
          const apiService = new StreamDeckApiService(
            credentials,
            this.getNode()
          );

          const machines = await apiService.getMachines();

          return machines.map((machine: StreamDeckMachine) => ({
            name: `${machine.name} (${machine.hostname})`,
            value: machine.id,
            description: `${machine.platform} - ${machine.status}`,
          }));
        } catch (error) {
          throw new NodeOperationError(
            this.getNode(),
            `Failed to load machines: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      },

      async loadDevices(
        this: ILoadOptionsFunctions
      ): Promise<INodePropertyOptions[]> {
        try {
          const credentials = await this.getCredentials('streamDeckApi');
          const apiService = new StreamDeckApiService(
            credentials,
            this.getNode()
          );
          const machine = this.getCurrentNodeParameter('machine') as string;

          if (!machine) {
            return [];
          }

          const devices = await apiService.getDevices(machine);

          return devices.map((device: StreamDeckDevice) => ({
            name: `${device.name} (${device.model})`,
            value: device.id,
            description: `${device.serialNumber} - ${device.buttonCount} buttons - ${device.connected ? 'Connected' : 'Disconnected'}`,
          }));
        } catch (error) {
          throw new NodeOperationError(
            this.getNode(),
            `Failed to load devices: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      },

      async loadButtons(
        this: ILoadOptionsFunctions
      ): Promise<INodePropertyOptions[]> {
        try {
          const credentials = await this.getCredentials('streamDeckApi');
          const apiService = new StreamDeckApiService(
            credentials,
            this.getNode()
          );
          const deviceId = this.getCurrentNodeParameter('device') as string;

          if (!deviceId) {
            return [];
          }

          const [buttons, device] = await Promise.all([
            apiService.getButtons(deviceId),
            apiService.getDevice(deviceId),
          ]);

          const options: INodePropertyOptions[] = [];

          // Add option for any button
          options.push({
            name: 'Any Button',
            value: '*',
            description: 'Trigger on any button press',
          });

          // Add specific buttons
          buttons.forEach((button: StreamDeckButton) => {
            options.push({
              name: button.title || `Button ${button.position + 1}`,
              value: button.id,
              description: `Position ${button.position + 1}${button.enabled ? '' : ' (disabled)'}${button.title ? ` - ${button.title}` : ''}`,
            });
          });

          // Add empty positions
          const usedPositions = new Set(
            buttons.map((b: StreamDeckButton) => b.position)
          );
          for (let i = 0; i < device.buttonCount; i++) {
            if (!usedPositions.has(i)) {
              options.push({
                name: `Empty Position ${i + 1}`,
                value: `position:${i}`,
                description: `Empty button at position ${i + 1}`,
              });
            }
          }

          return options;
        } catch (error) {
          throw new NodeOperationError(
            this.getNode(),
            `Failed to load buttons: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      },
    },
  };

  async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
    const machine = this.getNodeParameter('machine') as string;
    const deviceId = this.getNodeParameter('device') as string;
    const buttonId = this.getNodeParameter('button') as string;
    const buttonEvents = this.getNodeParameter('buttonEvents') as string[];
    const includeButtonData = this.getNodeParameter(
      'includeButtonData'
    ) as boolean;
    const includeDeviceData = this.getNodeParameter(
      'includeDeviceData'
    ) as boolean;
    const includeMachineData = this.getNodeParameter(
      'includeMachineData'
    ) as boolean;

    const credentials = await this.getCredentials('streamDeckApi');
    const apiService = new StreamDeckApiService(credentials, this.getNode());

    const triggerFunctions = this;

    return {
      manualTriggerFunction: async () => {
        // Manual trigger for testing
        const testData = await createTestTriggerData(
          apiService,
          machine,
          deviceId,
          buttonId,
          includeButtonData,
          includeDeviceData,
          includeMachineData
        );

        triggerFunctions.emit([
          [
            {
              json: testData,
            },
          ],
        ]);
      },
    };
  }

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const bodyData = this.getBodyData() as IDataObject;
    const queryData = this.getQueryData() as IDataObject;
    const headersData = this.getHeaderData() as IDataObject;

    // Get node parameters from the trigger configuration
    const machine = this.getNodeParameter('machine') as string;
    const deviceId = this.getNodeParameter('device') as string;
    const buttonId = this.getNodeParameter('button') as string;
    const buttonEvents = this.getNodeParameter('buttonEvents') as string[];
    const includeButtonData = this.getNodeParameter(
      'includeButtonData'
    ) as boolean;
    const includeDeviceData = this.getNodeParameter(
      'includeDeviceData'
    ) as boolean;
    const includeMachineData = this.getNodeParameter(
      'includeMachineData'
    ) as boolean;

    const credentials = await this.getCredentials('streamDeckApi');
    const apiService = new StreamDeckApiService(credentials, this.getNode());

    try {
      // Validate webhook payload
      if (!apiService.validateWebhookPayload(bodyData)) {
        console.warn('Invalid webhook payload received:', bodyData);
        return {
          noWebhookResponse: true,
        };
      }

      // Transform raw event data
      const buttonEvent = apiService.transformButtonPressEvent(bodyData);

      // Filter events based on configuration
      if (!buttonEvents.includes(buttonEvent.event)) {
        return {
          noWebhookResponse: true,
        };
      }

      // Filter by device
      if (deviceId !== '*' && buttonEvent.deviceId !== deviceId) {
        return {
          noWebhookResponse: true,
        };
      }

      // Filter by button
      if (
        buttonId !== '*' &&
        buttonEvent.buttonId !== buttonId &&
        !buttonId.startsWith('position:')
      ) {
        // Handle position-based filtering
        if (buttonId.startsWith('position:')) {
          const expectedPosition = parseInt(buttonId.split(':')[1], 10);
          if (buttonEvent.position !== expectedPosition) {
            return {
              noWebhookResponse: true,
            };
          }
        } else {
          return {
            noWebhookResponse: true,
          };
        }
      }

      // Build output data
      const outputData = await buildOutputData(
        apiService,
        buttonEvent,
        machine,
        includeButtonData,
        includeDeviceData,
        includeMachineData,
        headersData,
        queryData
      );
      return {
        workflowData: [
          [
            {
              json: outputData,
            },
          ],
        ],
      };
    } catch (error) {
      console.error('StreamDeck webhook processing error:', error);

      // Return error data to workflow for debugging
      return {
        workflowData: [
          [
            {
              json: {
                error: true,
                message:
                  error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
                rawPayload: bodyData,
              },
            },
          ],
        ],
      };
    }
  }
}
