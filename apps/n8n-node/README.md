# StreamDeck N8N Node

A custom N8N node that allows you to trigger workflows from StreamDeck button presses.

## Features

- **Webhook Trigger**: Receive button press events via webhooks
- **Dynamic Device Selection**: Load machines, devices, and buttons dynamically from your StreamDeck server
- **Event Filtering**: Choose which button events (pressed/released) trigger workflows
- **Button Data**: Optionally include button configuration data in workflow output
- **Multi-Device Support**: Support for multiple StreamDeck devices across different machines

## Installation

### Option 1: Install from npm (when published)

```bash
npm install @n8n-streamdeck/n8n-node
```

### Option 2: Install from local build

1. Build the package:

   ```bash
   npm run build
   ```

2. Install in your N8N instance:
   ```bash
   npm install /path/to/n8n-streamdeck/apps/n8n-node
   ```

### Option 3: Development Installation

1. Link the package for development:

   ```bash
   cd /path/to/n8n-streamdeck/apps/n8n-node
   npm link

   cd /path/to/your/n8n/installation
   npm link @n8n-streamdeck/n8n-node
   ```

## Configuration

### 1. Set up StreamDeck API Credentials

1. In N8N, go to **Credentials** → **Create New**
2. Search for "StreamDeck API" and select it
3. Configure:
   - **StreamDeck Server URL**: Your StreamDeck server URL (e.g., `http://localhost:3001`)
   - **API Key**: Your API key (if authentication is enabled)
   - **Connection Timeout**: Connection timeout in milliseconds (default: 5000)

### 2. Create a StreamDeck Trigger Node

1. Create a new workflow in N8N
2. Add a **StreamDeck Trigger** node
3. Configure:
   - **Credentials**: Select your StreamDeck API credentials
   - **Machine**: Select the machine hosting your StreamDeck devices
   - **Device**: Select the specific StreamDeck device
   - **Button**: Select the button to monitor (or "Any Button" for all buttons)
   - **Button Events**: Choose which events trigger the workflow (pressed/released)
   - **Include Button Data**: Whether to include button configuration in the output

## Usage

### Webhook URL

Once configured, the node will provide a webhook URL that looks like:

```
https://your-n8n-instance.com/webhook/streamdeck
```

### StreamDeck Server Integration

Configure your StreamDeck server to send webhook requests to the N8N webhook URL when buttons are pressed.

### Workflow Output

The node outputs data in this format:

```json
{
  "event": "pressed",
  "deviceId": "streamdeck-device-1",
  "buttonId": "button-123",
  "position": 0,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "machine": "local",
  "headers": { ... },
  "query": { ... },
  "button": {
    "title": "My Button",
    "backgroundColor": "#3b82f6",
    "enabled": true,
    ...
  }
}
```

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
npm run lint:fix
```

### Development Mode

```bash
npm run dev
```

## Node Structure

```
src/
├── credentials/
│   └── StreamDeckApi.credentials.ts    # API credentials definition
├── nodes/
│   └── StreamDeckTrigger/
│       ├── StreamDeckTrigger.node.ts   # Main node implementation
│       └── StreamDeckTrigger.node.json # Node metadata
├── icons/
│   └── streamdeck.svg                  # Node icon
└── index.ts                           # Package exports
```

## API Integration

The node integrates with your StreamDeck server API and expects these endpoints:

- `GET /api/machines` - List available machines
- `GET /api/devices` - List StreamDeck devices
- `GET /api/devices/:id` - Get device details
- `GET /api/devices/:id/buttons` - List device buttons
- `GET /api/health` - Health check for credential testing

## Troubleshooting

### Node Not Appearing in N8N

1. Ensure the package is properly installed
2. Restart your N8N instance
3. Check N8N logs for any loading errors

### Credential Test Failing

1. Verify your StreamDeck server is running
2. Check the server URL is correct and accessible
3. Ensure the API key is valid (if using authentication)
4. Check firewall settings

### Webhook Not Triggering

1. Verify the webhook URL is correctly configured in your StreamDeck server
2. Check that the device and button filters match your configuration
3. Ensure the selected events (pressed/released) match what you're testing

## License

MIT

## Support

For issues and questions, please visit: https://github.com/your-org/n8n-streamdeck/issues
