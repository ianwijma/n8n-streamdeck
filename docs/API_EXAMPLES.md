# N8N StreamDeck API Examples

This document provides practical examples for using the N8N StreamDeck API.

## Table of Contents

- [Authentication](#authentication)
- [Device Management](#device-management)
- [Button Configuration](#button-configuration)
- [Error Handling](#error-handling)
- [SDK Examples](#sdk-examples)

## Authentication

### Initial Setup

```bash
# Check if setup is required
curl -X GET http://localhost:3000/api/auth/setup/check

# Complete initial setup
curl -X POST http://localhost:3000/api/auth/setup \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "securePassword123"
  }'
```

### Login and Token Management

```bash
# Login to get access token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "securePassword123"
  }'

# Response:
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user_123",
      "username": "admin",
      "role": "admin"
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}

# Use token in subsequent requests
export TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Refresh token
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Cookie: refreshToken=abc123"
```

## Device Management

### List All Devices

```bash
curl -X GET http://localhost:3000/api/devices \
  -H "Authorization: Bearer $TOKEN"
```

```javascript
// JavaScript/Node.js
const response = await fetch('http://localhost:3000/api/devices', {
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});

const { data: devices } = await response.json();
console.log('Connected devices:', devices);
```

```python
# Python
import requests

headers = {
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
}

response = requests.get('http://localhost:3000/api/devices', headers=headers)
devices = response.json()['data']
print(f'Connected devices: {devices}')
```

### Connect to Device

```bash
curl -X POST http://localhost:3000/api/devices/streamdeck_001/connect \
  -H "Authorization: Bearer $TOKEN"
```

### Update Device Brightness

```bash
curl -X PUT http://localhost:3000/api/devices/streamdeck_001/brightness \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"brightness": 75}'
```

## Button Configuration

### Configure a Button

```bash
curl -X POST http://localhost:3000/api/devices/streamdeck_001/buttons \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "position": 0,
    "title": "Deploy App",
    "backgroundColor": "#FF0000",
    "n8nWorkflowId": "wf_123456",
    "n8nWebhookUrl": "https://n8n.example.com/webhook/streamdeck-trigger",
    "enabled": true
  }'
```

```javascript
// JavaScript/Node.js - Configure button with icon
const buttonConfig = {
  position: 0,
  title: 'Deploy App',
  icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  backgroundColor: '#FF0000',
  n8nWorkflowId: 'wf_123456',
  n8nWebhookUrl: 'https://n8n.example.com/webhook/streamdeck-trigger',
  enabled: true,
};

const response = await fetch(
  'http://localhost:3000/api/devices/streamdeck_001/buttons',
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buttonConfig),
  }
);

const result = await response.json();
console.log('Button configured:', result.data);
```

### Update Button Configuration

```bash
curl -X PUT http://localhost:3000/api/devices/streamdeck_001/buttons/0 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Deploy Production",
    "backgroundColor": "#00FF00"
  }'
```

### List Device Buttons

```bash
curl -X GET http://localhost:3000/api/devices/streamdeck_001/buttons \
  -H "Authorization: Bearer $TOKEN"
```

### Simulate Button Press

```bash
curl -X POST http://localhost:3000/api/devices/streamdeck_001/buttons/0/press \
  -H "Authorization: Bearer $TOKEN"
```

## Error Handling

### Common Error Responses

```javascript
// Handle API errors
async function apiCall(url, options) {
  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!data.success) {
      throw new Error(`API Error: ${data.error.code} - ${data.error.message}`);
    }

    return data.data;
  } catch (error) {
    console.error('API call failed:', error.message);
    throw error;
  }
}

// Usage
try {
  const devices = await apiCall('http://localhost:3000/api/devices', {
    headers: { Authorization: `Bearer ${token}` },
  });
} catch (error) {
  // Handle specific error codes
  if (error.message.includes('UNAUTHORIZED')) {
    // Redirect to login
  } else if (error.message.includes('DEVICE_NOT_FOUND')) {
    // Show device not found message
  }
}
```

### Validation Errors

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "position",
      "message": "Position must be between 0 and 14"
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "requestId": "req_123456789"
}
```

## SDK Examples

### JavaScript/TypeScript SDK

```typescript
// streamdeck-client.ts
interface StreamDeckConfig {
  baseUrl: string;
  token?: string;
}

interface Device {
  id: string;
  name: string;
  type: string;
  connected: boolean;
  buttonCount: number;
  brightness?: number;
}

interface Button {
  id: string;
  deviceId: string;
  position: number;
  enabled: boolean;
  title?: string;
  icon?: string;
  backgroundColor?: string;
  n8nWorkflowId?: string;
  n8nWebhookUrl?: string;
}

class StreamDeckClient {
  private config: StreamDeckConfig;

  constructor(config: StreamDeckConfig) {
    this.config = config;
  }

  setToken(token: string) {
    this.config.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.config.token && {
        Authorization: `Bearer ${this.config.token}`,
      }),
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });
    const data = await response.json();

    if (!data.success) {
      throw new Error(`${data.error.code}: ${data.error.message}`);
    }

    return data.data;
  }

  // Authentication
  async login(username: string, password: string) {
    return this.request<{ accessToken: string; user: any }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  async checkSetup() {
    return this.request<{ setupRequired: boolean }>('/api/auth/setup/check');
  }

  // Devices
  async getDevices(): Promise<Device[]> {
    return this.request<Device[]>('/api/devices');
  }

  async getDevice(deviceId: string): Promise<Device> {
    return this.request<Device>(`/api/devices/${deviceId}`);
  }

  async connectDevice(deviceId: string): Promise<Device> {
    return this.request<Device>(`/api/devices/${deviceId}/connect`, {
      method: 'POST',
    });
  }

  async updateBrightness(deviceId: string, brightness: number): Promise<void> {
    return this.request(`/api/devices/${deviceId}/brightness`, {
      method: 'PUT',
      body: JSON.stringify({ brightness }),
    });
  }

  // Buttons
  async getButtons(deviceId: string): Promise<Button[]> {
    return this.request<Button[]>(`/api/devices/${deviceId}/buttons`);
  }

  async configureButton(
    deviceId: string,
    config: Partial<Button>
  ): Promise<Button> {
    return this.request<Button>(`/api/devices/${deviceId}/buttons`, {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async updateButton(
    deviceId: string,
    position: number,
    config: Partial<Button>
  ): Promise<Button> {
    return this.request<Button>(
      `/api/devices/${deviceId}/buttons/${position}`,
      {
        method: 'PUT',
        body: JSON.stringify(config),
      }
    );
  }

  async deleteButton(deviceId: string, position: number): Promise<void> {
    return this.request(`/api/devices/${deviceId}/buttons/${position}`, {
      method: 'DELETE',
    });
  }

  async pressButton(deviceId: string, position: number): Promise<any> {
    return this.request(`/api/devices/${deviceId}/buttons/${position}/press`, {
      method: 'POST',
    });
  }
}

// Usage example
const client = new StreamDeckClient({
  baseUrl: 'http://localhost:3000',
});

async function main() {
  try {
    // Login
    const auth = await client.login('admin', 'password');
    client.setToken(auth.accessToken);

    // Get devices
    const devices = await client.getDevices();
    console.log('Devices:', devices);

    if (devices.length > 0) {
      const deviceId = devices[0].id;

      // Configure a button
      const button = await client.configureButton(deviceId, {
        position: 0,
        title: 'Deploy',
        backgroundColor: '#FF0000',
        n8nWebhookUrl: 'https://n8n.example.com/webhook/deploy',
      });

      console.log('Button configured:', button);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
```

### Python SDK

```python
# streamdeck_client.py
import requests
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

@dataclass
class Device:
    id: str
    name: str
    type: str
    connected: bool
    button_count: int
    brightness: Optional[int] = None

@dataclass
class Button:
    id: str
    device_id: str
    position: int
    enabled: bool
    title: Optional[str] = None
    icon: Optional[str] = None
    background_color: Optional[str] = None
    n8n_workflow_id: Optional[str] = None
    n8n_webhook_url: Optional[str] = None

class StreamDeckClient:
    def __init__(self, base_url: str, token: Optional[str] = None):
        self.base_url = base_url.rstrip('/')
        self.token = token
        self.session = requests.Session()

    def set_token(self, token: str):
        self.token = token
        self.session.headers.update({'Authorization': f'Bearer {token}'})

    def _request(self, method: str, endpoint: str, **kwargs) -> Any:
        url = f"{self.base_url}{endpoint}"
        headers = kwargs.pop('headers', {})

        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        response = self.session.request(method, url, headers=headers, **kwargs)
        data = response.json()

        if not data.get('success', False):
            error = data.get('error', {})
            raise Exception(f"{error.get('code', 'UNKNOWN')}: {error.get('message', 'Unknown error')}")

        return data.get('data')

    # Authentication
    def login(self, username: str, password: str) -> Dict[str, Any]:
        return self._request('POST', '/api/auth/login',
                           json={'username': username, 'password': password})

    def check_setup(self) -> Dict[str, Any]:
        return self._request('GET', '/api/auth/setup/check')

    # Devices
    def get_devices(self) -> List[Device]:
        data = self._request('GET', '/api/devices')
        return [Device(**device) for device in data]

    def get_device(self, device_id: str) -> Device:
        data = self._request('GET', f'/api/devices/{device_id}')
        return Device(**data)

    def connect_device(self, device_id: str) -> Device:
        data = self._request('POST', f'/api/devices/{device_id}/connect')
        return Device(**data)

    def update_brightness(self, device_id: str, brightness: int) -> None:
        self._request('PUT', f'/api/devices/{device_id}/brightness',
                     json={'brightness': brightness})

    # Buttons
    def get_buttons(self, device_id: str) -> List[Button]:
        data = self._request('GET', f'/api/devices/{device_id}/buttons')
        return [Button(**button) for button in data]

    def configure_button(self, device_id: str, **config) -> Button:
        data = self._request('POST', f'/api/devices/{device_id}/buttons', json=config)
        return Button(**data)

    def update_button(self, device_id: str, position: int, **config) -> Button:
        data = self._request('PUT', f'/api/devices/{device_id}/buttons/{position}', json=config)
        return Button(**data)

    def delete_button(self, device_id: str, position: int) -> None:
        self._request('DELETE', f'/api/devices/{device_id}/buttons/{position}')

    def press_button(self, device_id: str, position: int) -> Any:
        return self._request('POST', f'/api/devices/{device_id}/buttons/{position}/press')

# Usage example
if __name__ == '__main__':
    client = StreamDeckClient('http://localhost:3000')

    try:
        # Login
        auth = client.login('admin', 'password')
        client.set_token(auth['accessToken'])

        # Get devices
        devices = client.get_devices()
        print(f'Found {len(devices)} devices')

        if devices:
            device_id = devices[0].id

            # Configure a button
            button = client.configure_button(
                device_id,
                position=0,
                title='Deploy',
                background_color='#FF0000',
                n8n_webhook_url='https://n8n.example.com/webhook/deploy'
            )

            print(f'Button configured: {button}')

    except Exception as e:
        print(f'Error: {e}')
```

## Rate Limiting

The API implements rate limiting on sensitive endpoints:

- **Login**: 5 attempts per 15 minutes
- **Setup**: 3 attempts per hour
- **Password Change**: 3 attempts per hour

When rate limited, you'll receive a `429 Too Many Requests` response:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many login attempts"
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "requestId": "req_123456789"
}
```

## WebSocket Events

The API also supports real-time events via WebSocket:

```javascript
// Connect to WebSocket for real-time events
const socket = io('http://localhost:3000', {
  auth: {
    token: accessToken,
  },
});

// Listen for button press events
socket.on('button:pressed', (data) => {
  console.log('Button pressed:', data);
  // { deviceId: 'streamdeck_001', position: 0, timestamp: '...' }
});

// Listen for device connection events
socket.on('device:connected', (data) => {
  console.log('Device connected:', data);
});

socket.on('device:disconnected', (data) => {
  console.log('Device disconnected:', data);
});
```

## Error Codes Reference

| Code                       | Description                        | HTTP Status |
| -------------------------- | ---------------------------------- | ----------- |
| `UNAUTHORIZED`             | Authentication required            | 401         |
| `FORBIDDEN`                | Insufficient permissions           | 403         |
| `NOT_FOUND`                | Resource not found                 | 404         |
| `VALIDATION_ERROR`         | Invalid request data               | 400         |
| `DEVICE_NOT_FOUND`         | StreamDeck device not found        | 404         |
| `DEVICE_ALREADY_CONNECTED` | Device already connected           | 409         |
| `BUTTON_POSITION_OCCUPIED` | Button position already configured | 409         |
| `RATE_LIMIT_EXCEEDED`      | Too many requests                  | 429         |
| `INTERNAL_ERROR`           | Server error                       | 500         |
| `SERVICE_UNAVAILABLE`      | Service temporarily unavailable    | 503         |
