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

# Copy the built n8n-node package contents and production package.json
COPY --chown=node:node apps/n8n-node/dist/. /home/node/.n8n/custom/
COPY --chown=node:node docker/n8n/package.json /home/node/.n8n/custom/

# Fix permissions and install dependencies first
USER root
RUN chown -R node:node /home/node/.n8n
USER node

# Install dependencies in the custom directory
WORKDIR /home/node/.n8n/custom
RUN npm install --omit=dev --omit=optional

# Now copy built shared packages to node_modules (after npm install)
USER root
RUN mkdir -p /home/node/.n8n/custom/node_modules/@n8n-streamdeck/shared && \
    mkdir -p /home/node/.n8n/custom/node_modules/@n8n-streamdeck/config

COPY --chown=node:node packages/shared/dist /home/node/.n8n/custom/node_modules/@n8n-streamdeck/shared/
COPY --chown=node:node packages/config/dist /home/node/.n8n/custom/node_modules/@n8n-streamdeck/config/

# Create package.json files for the shared packages
RUN echo '{"name":"@n8n-streamdeck/shared","version":"1.0.0","main":"index.js"}' > /home/node/.n8n/custom/node_modules/@n8n-streamdeck/shared/package.json && \
    echo '{"name":"@n8n-streamdeck/config","version":"1.0.0","main":"index.js"}' > /home/node/.n8n/custom/node_modules/@n8n-streamdeck/config/package.json

# Fix final permissions
RUN chown -R node:node /home/node/.n8n
USER node

# Set working directory back to n8n default
WORKDIR /home/node

# Set environment variables for N8N
ENV N8N_USER_FOLDER="/home/node/.n8n"
ENV N8N_CUSTOM_EXTENSIONS="/home/node/.n8n/custom"

# Expose N8N port
EXPOSE 5678

# Start N8N using the default entrypoint
CMD ["start"]