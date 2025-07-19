import {
  IDataObject,
  ILoadOptionsFunctions,
  INodePropertyOptions,
  INodeType,
  INodeTypeDescription,
  IWebhookFunctions,
  IWebhookResponseData,
  NodeConnectionType,
  NodeOperationError,
} from 'n8n-workflow';
import axios from 'axios';

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
    ],
  };

  methods = {
    loadOptions: {
      async loadMachines(
        this: ILoadOptionsFunctions
      ): Promise<INodePropertyOptions[]> {
        const credentials = await this.getCredentials('streamDeckApi');
        const serverUrl = credentials.serverUrl as string;

        try {
          const response = await axios.get(`${serverUrl}/api/machines`, {
            headers: {
              Authorization: credentials.apiKey
                ? `Bearer ${credentials.apiKey}`
                : undefined,
            },
            timeout: (credentials.timeout as number) || 5000,
          });

          const machines = response.data.data || [];
          return machines.map((machine: any) => ({
            name: machine.name || machine.hostname || machine.id,
            value: machine.id,
            description: `${machine.hostname} - ${machine.platform}`,
          }));
        } catch (error) {
          // Fallback to local machine if API call fails
          return [
            {
              name: 'Local Machine',
              value: 'local',
              description: 'Local StreamDeck server',
            },
          ];
        }
      },

      async loadDevices(
        this: ILoadOptionsFunctions
      ): Promise<INodePropertyOptions[]> {
        const credentials = await this.getCredentials('streamDeckApi');
        const serverUrl = credentials.serverUrl as string;
        const machine = this.getCurrentNodeParameter('machine') as string;

        if (!machine) {
          return [];
        }

        try {
          const response = await axios.get(`${serverUrl}/api/devices`, {
            headers: {
              Authorization: credentials.apiKey
                ? `Bearer ${credentials.apiKey}`
                : undefined,
            },
            params: {
              machine: machine !== 'local' ? machine : undefined,
            },
            timeout: (credentials.timeout as number) || 5000,
          });

          const devices = response.data.data || [];
          return devices.map((device: any) => ({
            name: `${device.name} (${device.model})`,
            value: device.id,
            description: `${device.serialNumber} - ${device.buttonCount} buttons`,
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
        const credentials = await this.getCredentials('streamDeckApi');
        const serverUrl = credentials.serverUrl as string;
        const deviceId = this.getCurrentNodeParameter('device') as string;

        if (!deviceId) {
          return [];
        }

        try {
          const response = await axios.get(
            `${serverUrl}/api/devices/${deviceId}/buttons`,
            {
              headers: {
                Authorization: credentials.apiKey
                  ? `Bearer ${credentials.apiKey}`
                  : undefined,
              },
              timeout: (credentials.timeout as number) || 5000,
            }
          );

          const buttons = response.data.data || [];
          const options: INodePropertyOptions[] = [];

          // Add option for any button
          options.push({
            name: 'Any Button',
            value: '*',
            description: 'Trigger on any button press',
          });

          // Add specific buttons
          buttons.forEach((button: any) => {
            options.push({
              name: button.title || `Button ${button.position + 1}`,
              value: button.id,
              description: `Position ${button.position + 1}${button.enabled ? '' : ' (disabled)'}`,
            });
          });

          // Add empty positions
          const deviceResponse = await axios.get(
            `${serverUrl}/api/devices/${deviceId}`,
            {
              headers: {
                Authorization: credentials.apiKey
                  ? `Bearer ${credentials.apiKey}`
                  : undefined,
              },
              timeout: (credentials.timeout as number) || 5000,
            }
          );

          const device = deviceResponse.data.data;
          const usedPositions = new Set(buttons.map((b: any) => b.position));

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

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const machine = this.getNodeParameter('machine') as string;
    const deviceId = this.getNodeParameter('device') as string;
    const buttonId = this.getNodeParameter('button') as string;
    const buttonEvents = this.getNodeParameter('buttonEvents') as string[];
    const includeButtonData = this.getNodeParameter(
      'includeButtonData'
    ) as boolean;

    const bodyData = this.getBodyData() as IDataObject;
    const queryData = this.getQueryData() as IDataObject;
    const headersData = this.getHeaderData() as IDataObject;

    // Validate the webhook payload
    if (!bodyData.event || !bodyData.deviceId) {
      return {
        noWebhookResponse: true,
      };
    }

    // Filter events based on configuration
    if (!buttonEvents.includes(bodyData.event as string)) {
      return {
        noWebhookResponse: true,
      };
    }

    // Filter by device and button
    if (deviceId !== '*' && bodyData.deviceId !== deviceId) {
      return {
        noWebhookResponse: true,
      };
    }

    if (
      buttonId !== '*' &&
      bodyData.buttonId !== buttonId &&
      !bodyData.buttonId?.toString().startsWith('position:')
    ) {
      return {
        noWebhookResponse: true,
      };
    }

    const outputData: IDataObject = {
      event: bodyData.event,
      deviceId: bodyData.deviceId,
      buttonId: bodyData.buttonId,
      position: bodyData.position,
      timestamp: bodyData.timestamp || new Date().toISOString(),
      machine,
      headers: headersData,
      query: queryData,
    };

    // Include button data if requested
    if (includeButtonData && bodyData.button) {
      outputData.button = bodyData.button;
    }

    return {
      workflowData: [
        [
          {
            json: outputData,
          },
        ],
      ],
    };
  }
}
