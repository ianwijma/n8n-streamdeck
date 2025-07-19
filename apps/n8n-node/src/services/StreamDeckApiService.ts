import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  ICredentialDataDecryptedObject,
  NodeOperationError,
  INode,
} from 'n8n-workflow';

export interface StreamDeckMachine {
  id: string;
  name: string;
  hostname: string;
  platform: string;
  status: 'online' | 'offline';
  lastSeen?: string;
}

export interface StreamDeckDevice {
  id: string;
  name: string;
  model: string;
  serialNumber: string;
  connected: boolean;
  buttonCount: number;
  columns: number;
  rows: number;
  firmwareVersion: string;
  lastSeen?: string;
}

export interface StreamDeckButton {
  id: string;
  deviceId: string;
  position: number;
  title?: string;
  icon?: string;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  enabled: boolean;
  action?: {
    type: string;
    config: any;
  };
}

export interface WebhookRegistration {
  id: string;
  url: string;
  deviceId: string;
  buttonId?: string;
  events: string[];
  active: boolean;
  createdAt: string;
}

export interface ButtonPressEvent {
  event: 'pressed' | 'released';
  deviceId: string;
  buttonId?: string;
  position: number;
  timestamp: string;
  button?: StreamDeckButton;
  device?: StreamDeckDevice;
  machine?: StreamDeckMachine;
}

export class StreamDeckApiService {
  private client: AxiosInstance;
  private credentials: ICredentialDataDecryptedObject;
  private node: INode;

  constructor(credentials: ICredentialDataDecryptedObject, node: INode) {
    this.credentials = credentials;
    this.node = node;

    const serverUrl = credentials.serverUrl as string;
    const timeout = (credentials.timeout as number) || 10000;

    this.client = axios.create({
      baseURL: serverUrl,
      timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'N8N-StreamDeck-Node/1.0.0',
      },
    });

    // Add auth header if API key is provided
    if (credentials.apiKey) {
      this.client.defaults.headers.common['Authorization'] =
        `Bearer ${credentials.apiKey}`;
    }

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        throw this.handleApiError(error);
      }
    );
  }

  private handleApiError(error: AxiosError): NodeOperationError {
    let message = 'StreamDeck API request failed';

    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const data = error.response.data as any;

      switch (status) {
        case 401:
          message = 'Authentication failed. Check your API key.';
          break;
        case 403:
          message = 'Access forbidden. Check your permissions.';
          break;
        case 404:
          message = 'Resource not found. Check your configuration.';
          break;
        case 500:
          message = 'StreamDeck server error. Please try again later.';
          break;
        default:
          message = data?.message || `HTTP ${status}: ${error.message}`;
      }
    } else if (error.request) {
      // Network error
      message = `Cannot connect to StreamDeck server at ${this.credentials.serverUrl}. Check if the server is running and accessible.`;
    } else {
      // Other error
      message = error.message;
    }

    return new NodeOperationError(this.node, message, {
      description: 'StreamDeck API Error',
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/health');
      return response.data?.status === 'healthy';
    } catch (error) {
      throw error;
    }
  }

  async getMachines(): Promise<StreamDeckMachine[]> {
    try {
      const response = await this.client.get('/api/machines');
      return response.data?.data || [];
    } catch (error) {
      // If machines endpoint doesn't exist, return local machine
      if (
        error instanceof NodeOperationError &&
        error.message.includes('404')
      ) {
        return [
          {
            id: 'local',
            name: 'Local Machine',
            hostname: 'localhost',
            platform: 'unknown',
            status: 'online',
          },
        ];
      }
      throw error;
    }
  }

  async getDevices(machineId?: string): Promise<StreamDeckDevice[]> {
    try {
      const params =
        machineId && machineId !== 'local' ? { machine: machineId } : {};
      const response = await this.client.get('/api/devices', { params });
      return response.data?.data || [];
    } catch (error) {
      throw error;
    }
  }

  async getDevice(deviceId: string): Promise<StreamDeckDevice> {
    try {
      const response = await this.client.get(`/api/devices/${deviceId}`);
      return response.data?.data;
    } catch (error) {
      throw error;
    }
  }

  async getButtons(deviceId: string): Promise<StreamDeckButton[]> {
    try {
      const response = await this.client.get(
        `/api/devices/${deviceId}/buttons`
      );
      return response.data?.data || [];
    } catch (error) {
      throw error;
    }
  }

  async getButton(
    deviceId: string,
    buttonId: string
  ): Promise<StreamDeckButton> {
    try {
      const response = await this.client.get(
        `/api/devices/${deviceId}/buttons/${buttonId}`
      );
      return response.data?.data;
    } catch (error) {
      throw error;
    }
  }

  async registerWebhook(
    webhookUrl: string,
    deviceId: string,
    buttonId?: string,
    events: string[] = ['pressed']
  ): Promise<WebhookRegistration> {
    try {
      const payload = {
        url: webhookUrl,
        deviceId,
        buttonId: buttonId === '*' ? undefined : buttonId,
        events,
        metadata: {
          source: 'n8n',
          nodeType: 'StreamDeckTrigger',
          version: '1.0.0',
        },
      };

      const response = await this.client.post('/api/webhooks', payload);
      return response.data?.data;
    } catch (error) {
      throw error;
    }
  }

  async unregisterWebhook(webhookId: string): Promise<void> {
    try {
      await this.client.delete(`/api/webhooks/${webhookId}`);
    } catch (error) {
      // Don't throw error if webhook doesn't exist (already deleted)
      if (
        error instanceof NodeOperationError &&
        !error.message.includes('404')
      ) {
        throw error;
      }
    }
  }

  async getWebhooks(): Promise<WebhookRegistration[]> {
    try {
      const response = await this.client.get('/api/webhooks');
      return response.data?.data || [];
    } catch (error) {
      throw error;
    }
  }

  async updateWebhook(
    webhookId: string,
    updates: Partial<WebhookRegistration>
  ): Promise<WebhookRegistration> {
    try {
      const response = await this.client.patch(
        `/api/webhooks/${webhookId}`,
        updates
      );
      return response.data?.data;
    } catch (error) {
      throw error;
    }
  }

  // Utility methods for data transformation
  transformButtonPressEvent(rawData: any): ButtonPressEvent {
    return {
      event: rawData.event || 'pressed',
      deviceId: rawData.deviceId,
      buttonId: rawData.buttonId,
      position: rawData.position || 0,
      timestamp: rawData.timestamp || new Date().toISOString(),
      button: rawData.button,
      device: rawData.device,
      machine: rawData.machine,
    };
  }

  // Validate webhook payload
  validateWebhookPayload(payload: any): boolean {
    return !!(
      payload &&
      payload.event &&
      payload.deviceId &&
      typeof payload.position === 'number'
    );
  }

  // Generate webhook metadata for N8N
  generateWebhookMetadata(
    deviceId: string,
    buttonId?: string,
    events: string[] = ['pressed']
  ) {
    return {
      deviceId,
      buttonId,
      events,
      registeredAt: new Date().toISOString(),
      source: 'n8n-streamdeck-trigger',
    };
  }
}
