-- Initialize N8N database
-- This script runs when the PostgreSQL container starts for the first time

-- Create additional databases if needed
-- CREATE DATABASE n8n_test;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE n8n_dev TO n8n_user;

-- Create extensions that N8N might need
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Log initialization
SELECT 'N8N PostgreSQL database initialized successfully' AS status;