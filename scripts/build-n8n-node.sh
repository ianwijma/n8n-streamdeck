#!/bin/bash

# Build script for N8N StreamDeck node
set -e

echo "🔨 Building N8N StreamDeck Node for Docker..."

# Navigate to project root
cd "$(dirname "$0")/.."

# Build shared packages first
echo "📦 Building shared packages..."
pnpm --filter @n8n-streamdeck/shared build
pnpm --filter @n8n-streamdeck/config build

# Build the n8n-node
echo "🔧 Building N8N node..."
pnpm --filter @n8n-streamdeck/n8n-node build

echo "✅ N8N node build complete!"