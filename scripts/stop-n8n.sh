#!/bin/bash

# Stop N8N Development Environment
set -e

echo "🛑 Stopping N8N Development Environment..."

# Navigate to project root
cd "$(dirname "$0")/.."

# Stop the N8N environment
docker-compose -f docker-compose.n8n.yml down

echo "✅ N8N Development environment stopped!"
echo ""
echo "💡 Your StreamDeck Backend (if running natively) is still running."
echo "   To stop it, use Ctrl+C in the terminal where it's running."