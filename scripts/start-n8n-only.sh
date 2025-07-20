#!/bin/bash

# Start N8N Development Environment (N8N + Dependencies Only)
# StreamDeck Backend should be running natively on host machine
set -e

echo "🚀 Starting N8N Development Environment (N8N + Dependencies Only)..."
echo "📝 Note: StreamDeck Backend should be running natively on your host machine"

# Navigate to project root
cd "$(dirname "$0")/.."

# Build the n8n-node first
echo "🔨 Building N8N StreamDeck node..."
./scripts/build-n8n-node.sh

# Start the N8N environment
echo "🐳 Starting N8N and dependencies..."
docker-compose -f docker-compose.n8n.yml up --build -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 15

# Check service health
echo "🔍 Checking service health..."

# Check if PostgreSQL is running
if docker exec n8n-streamdeck-postgres pg_isready -U n8n_user -d n8n_dev > /dev/null 2>&1; then
    echo "✅ PostgreSQL is running"
else
    echo "⚠️  PostgreSQL might still be starting up..."
fi

# Check if Redis is running
if docker exec n8n-streamdeck-redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis is running"
else
    echo "⚠️  Redis might still be starting up..."
fi

# Check if N8N is running
if curl -f http://localhost:5678/healthz > /dev/null 2>&1; then
    echo "✅ N8N is running at http://localhost:5678"
else
    echo "⚠️  N8N might still be starting up..."
fi

echo ""
echo "🎉 N8N Development environment started!"
echo ""
echo "📍 Services:"
echo "   • N8N:        http://localhost:5678"
echo "   • PostgreSQL: localhost:5432"
echo "   • Redis:      localhost:6379"
echo ""
echo "⚠️  Required for StreamDeck integration:"
echo "   • StreamDeck Backend must be running on: http://localhost:3001"
echo ""
echo "🔧 To start StreamDeck Backend natively:"
echo "   pnpm --filter @n8n-streamdeck/backend dev"
echo ""
echo "🔧 To start StreamDeck Frontend (optional):"
echo "   pnpm --filter @n8n-streamdeck/frontend dev"
echo ""
echo "📋 To view N8N logs:"
echo "   docker-compose -f docker-compose.n8n.yml logs -f n8n"
echo ""
echo "🛑 To stop N8N environment:"
echo "   docker-compose -f docker-compose.n8n.yml down"
echo ""
echo "💡 Setup StreamDeck credentials in N8N:"
echo "   • API URL: http://host.docker.internal:3001"
echo "   • API Key: dev-api-key (or your configured key)"