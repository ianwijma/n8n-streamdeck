# Multi-stage Dockerfile for N8N StreamDeck Frontend (Next.js)
# Stage 1: Build dependencies and compile application
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm@8

# Copy package files for dependency installation
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/config/package.json ./packages/config/
COPY apps/frontend/package.json ./apps/frontend/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/ ./packages/
COPY apps/frontend/ ./apps/frontend/
COPY tsconfig.json ./

# Build shared packages first
RUN pnpm --filter @n8n-streamdeck/shared build
RUN pnpm --filter @n8n-streamdeck/config build

# Set Next.js environment variables for build
ARG NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=${NODE_ENV}
ENV DOCKER_BUILD=1

# Build frontend application
RUN pnpm --filter @n8n-streamdeck/frontend build:docker

# Stage 2: Production runtime
FROM node:22-alpine AS runtime

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S frontend -u 1001

# Set working directory
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm@8

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/config/package.json ./packages/config/
COPY apps/frontend/package.json ./apps/frontend/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built application from builder stage
COPY --from=builder --chown=frontend:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=frontend:nodejs /app/packages/config/dist ./packages/config/dist
COPY --from=builder --chown=frontend:nodejs /app/apps/frontend/.next/standalone ./
COPY --from=builder --chown=frontend:nodejs /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder --chown=frontend:nodejs /app/apps/frontend/public ./apps/frontend/public

# Copy Next.js configuration
COPY --from=builder --chown=frontend:nodejs /app/apps/frontend/next.config.js ./apps/frontend/

# Create necessary directories
RUN mkdir -p /app/logs && \
    chown -R frontend:nodejs /app/logs

# Switch to non-root user
USER frontend

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { \
        process.exit(res.statusCode === 200 ? 0 : 1) \
    }).on('error', () => process.exit(1))"

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "apps/frontend/server.js"]