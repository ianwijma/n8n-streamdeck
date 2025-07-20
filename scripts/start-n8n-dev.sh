#!/bin/bash

# Start N8N Development Environment with StreamDeck Node
set -e

echo "🚀 Starting N8N Development Environment with StreamDeck Node..."

# Navigate to project root
cd "$(dirname "$0")/.."

# Build the n8n-node first
echo "🔨 Building N8N StreamDeck node..."
./scripts/build-n8n-node.sh

# Start the development environment
echo "🐳 Starting Docker containers..."
docker-compose -f docker-compose.dev.yml up --build -d n8n backend postgres redis

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check service health
echo "🔍 Checking service health..."

# Check if N8N is running
if curl -f http://localhost:5678/healthz > /dev/null 2>&1; then
    echo "✅ N8N is running at http://localhost:5678"
else
    echo "⚠️  N8N might still be starting up..."
fi

# Check if backend is running
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ StreamDeck Backend is running at http://localhost:3001"
else
    echo "⚠️  StreamDeck Backend might still be starting up..."
fi

echo ""
echo "🎉 Development environment started!"
echo ""
echo "📍 Services:"
echo "   • N8N:                http://localhost:5678"
echo "   • StreamDeck Backend: http://localhost:3001"
echo "   • StreamDeck Frontend: http://localhost:3000 (start separately)"
echo "   • PostgreSQL:         localhost:5432"
echo "   • Redis:              localhost:6379"
echo ""
echo "🔧 To start the frontend:"
echo "   pnpm --filter @n8n-streamdeck/frontend dev"
echo ""
echo "📋 To view logs:"
echo "   docker-compose -f docker-compose.dev.yml logs -f n8n"
echo "   docker-compose -f docker-compose.dev.yml logs -f backend"
echo ""
echo "🛑 To stop:"
echo "   docker-compose -f docker-compose.dev.yml down"