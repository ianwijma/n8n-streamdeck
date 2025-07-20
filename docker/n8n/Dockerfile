# N8N Development Dockerfile with StreamDeck Node
FROM n8nio/n8n:latest

# Switch to root to install packages
USER root

# Install necessary tools for building native modules
RUN apk add --no-cache \
    git \
    python3 \
    make \
    g++ \
    npm \
    && rm -rf /var/cache/apk/*

# Create directories for custom nodes
RUN mkdir -p /home/node/.n8n/custom

# Switch back to node user
USER node

# Set working directory
WORKDIR /home/node

# Copy the built n8n-node package and production package.json
COPY --chown=node:node apps/n8n-node/dist /home/node/.n8n/custom/
COPY --chown=node:node docker/n8n/package.json /home/node/.n8n/custom/

# Fix permissions and install dependencies
USER root
RUN chown -R node:node /home/node/.n8n
USER node

# Install dependencies in the custom directory
WORKDIR /home/node/.n8n/custom
RUN npm install --omit=dev --omit=optional

# Set working directory back to n8n default
WORKDIR /home/node

# Set environment variables for N8N
ENV N8N_USER_FOLDER="/home/node/.n8n"
ENV N8N_CUSTOM_EXTENSIONS="/home/node/.n8n/custom"

# Expose N8N port
EXPOSE 5678

# Start N8N
CMD ["n8n", "start"]