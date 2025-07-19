import {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class StreamDeckApi implements ICredentialType {
  name = 'streamDeckApi';
  displayName = 'StreamDeck API';
  documentationUrl = 'https://github.com/your-org/n8n-streamdeck';
  properties: INodeProperties[] = [
    {
      displayName: 'StreamDeck Server URL',
      name: 'serverUrl',
      type: 'string',
      default: 'http://localhost:3001',
      placeholder: 'http://localhost:3001',
      description: 'The URL of your StreamDeck server',
      required: true,
    },
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      placeholder: 'your-api-key',
      description: 'API key for authentication (if required)',
      required: false,
    },
    {
      displayName: 'Connection Timeout',
      name: 'timeout',
      type: 'number',
      default: 5000,
      description: 'Connection timeout in milliseconds',
      required: false,
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        Authorization: '=Bearer {{$credentials.apiKey}}',
        'Content-Type': 'application/json',
      },
    },
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.serverUrl}}',
      url: '/api/health',
      method: 'GET',
    },
    rules: [
      {
        type: 'responseSuccessBody',
        properties: {
          message: 'StreamDeck API connection successful',
          key: 'status',
          value: 'healthy',
        },
      },
    ],
  };
}
