#!/bin/bash

# Test N8N Development Setup
set -e

echo "🧪 Testing N8N Development Setup..."

# Navigate to project root
cd "$(dirname "$0")/.."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

echo "✅ Docker is running"

# Check if required files exist
if [ ! -f "docker/n8n/Dockerfile" ]; then
    echo "❌ N8N Dockerfile not found"
    exit 1
fi

if [ ! -f "docker-compose.dev.yml" ]; then
    echo "❌ Docker Compose file not found"
    exit 1
fi

echo "✅ Required files exist"

# Build the n8n-node
echo "🔨 Building N8N node..."
if ! pnpm --filter @n8n-streamdeck/n8n-node build; then
    echo "❌ Failed to build N8N node"
    exit 1
fi

echo "✅ N8N node built successfully"

# Check if built files exist
if [ ! -d "apps/n8n-node/dist" ]; then
    echo "❌ N8N node dist directory not found"
    exit 1
fi

if [ ! -f "apps/n8n-node/dist/apps/n8n-node/src/nodes/StreamDeckTrigger/StreamDeckTrigger.node.js" ]; then
    echo "❌ StreamDeck Trigger node not found in dist"
    exit 1
fi

if [ ! -f "apps/n8n-node/dist/apps/n8n-node/src/credentials/StreamDeckApi.credentials.js" ]; then
    echo "❌ StreamDeck credentials not found in dist"
    exit 1
fi

echo "✅ All required node files are present"

# Test Docker build (without starting)
echo "🐳 Testing Docker build..."
if ! docker-compose -f docker-compose.dev.yml build n8n; then
    echo "❌ Failed to build N8N Docker image"
    exit 1
fi

echo "✅ N8N Docker image built successfully"

echo ""
echo "🎉 N8N Development Setup Test Passed!"
echo ""
echo "📋 Next steps:"
echo "   1. Run: ./scripts/start-n8n-dev.sh"
echo "   2. Open: http://localhost:5678"
echo "   3. Look for StreamDeck nodes in the node palette"
echo ""