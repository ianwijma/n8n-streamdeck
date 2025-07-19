# N8N StreamDeck Integration

A comprehensive monorepo for integrating N8N workflows with Elgato StreamDeck, built with TypeScript and pnpm workspaces.

## 🏗️ Project Structure

```
n8n-streamdeck/
├── apps/
│   ├── backend/          # Node.js/Express API server
│   ├── frontend/         # Next.js React application
│   └── n8n-node/         # Custom N8N node package
├── packages/
│   ├── shared/           # Common types and utilities
│   └── config/           # Shared configuration
├── package.json          # Root package with workspace config
└── pnpm-workspace.yaml   # pnpm workspace configuration
```

## 🚀 Features

- **Monorepo Architecture**: Organized with pnpm workspaces for efficient dependency management
- **TypeScript**: Full TypeScript support with path mapping across all packages
- **Code Quality**: ESLint and Prettier configured for consistent code style
- **Testing**: Jest setup for all packages with coverage reporting
- **Development**: Hot reload and watch modes for all applications

## 📦 Packages

### Apps
- **@n8n-streamdeck/backend**: REST API server for handling StreamDeck interactions
- **@n8n-streamdeck/frontend**: Web interface for configuration and monitoring
- **@n8n-streamdeck/n8n-node**: Custom N8N node for StreamDeck integration

### Packages
- **@n8n-streamdeck/shared**: Common TypeScript types and utility functions
- **@n8n-streamdeck/config**: Centralized configuration management

## 🛠️ Development

### Prerequisites
- Node.js >= 18.0.0
- pnpm >= 8.0.0

### Installation
```bash
pnpm install
```

### Development Scripts
```bash
# Start all apps in development mode
pnpm dev

# Build all packages
pnpm build

# Run tests across all packages
pnpm test

# Lint all code
pnpm lint

# Format all code
pnpm format

# Type check all packages
pnpm typecheck
```

### Individual Package Commands
```bash
# Work with specific packages
pnpm --filter @n8n-streamdeck/backend dev
pnpm --filter @n8n-streamdeck/frontend build
pnpm --filter @n8n-streamdeck/shared test
```

## 🔧 Configuration

Environment variables can be configured in `.env` files:

```env
PORT=3000
N8N_URL=http://localhost:5678
N8N_API_KEY=your-api-key
STREAMDECK_PORT=28472
```

## 🧪 Testing

The project uses Jest for testing with coverage reporting:

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test --coverage

# Run tests in watch mode
pnpm test --watch
```

## 📝 License

MIT License - see LICENSE file for details.
