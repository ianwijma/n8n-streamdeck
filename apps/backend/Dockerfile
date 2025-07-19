# Multi-stage Dockerfile for N8N StreamDeck Backend
# Stage 1: Build dependencies and compile TypeScript
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm@8

# Copy package files for dependency installation
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/config/package.json ./packages/config/
COPY apps/backend/package.json ./apps/backend/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/ ./packages/
COPY apps/backend/ ./apps/backend/
COPY tsconfig.json ./

# Build shared packages first
RUN pnpm --filter @n8n-streamdeck/shared build
RUN pnpm --filter @n8n-streamdeck/config build

# Build backend application
RUN pnpm --filter @n8n-streamdeck/backend build

# Stage 2: Production runtime
FROM node:18-alpine AS runtime

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S backend -u 1001

# Set working directory
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm@8

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/config/package.json ./packages/config/
COPY apps/backend/package.json ./apps/backend/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built application from builder stage
COPY --from=builder --chown=backend:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=backend:nodejs /app/packages/config/dist ./packages/config/dist
COPY --from=builder --chown=backend:nodejs /app/apps/backend/dist ./apps/backend/dist

# Copy package.json files for runtime
COPY --chown=backend:nodejs packages/shared/package.json ./packages/shared/
COPY --chown=backend:nodejs packages/config/package.json ./packages/config/
COPY --chown=backend:nodejs apps/backend/package.json ./apps/backend/

# Create necessary directories
RUN mkdir -p /app/logs /app/data && \
    chown -R backend:nodejs /app/logs /app/data

# Switch to non-root user
USER backend

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (res) => { \
        process.exit(res.statusCode === 200 ? 0 : 1) \
    }).on('error', () => process.exit(1))"

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "apps/backend/dist/index.js"]