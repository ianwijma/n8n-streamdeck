export interface AppConfig {
  port: number;
  n8nUrl: string;
  n8nApiKey: string;
  streamDeckPort: number;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export const defaultConfig: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  n8nUrl: process.env.N8N_URL || 'http://localhost:5678',
  n8nApiKey: process.env.N8N_API_KEY || '',
  streamDeckPort: parseInt(process.env.STREAMDECK_PORT || '28472', 10),
};

export const getConfig = (): AppConfig => ({
  ...defaultConfig,
  port: parseInt(process.env.PORT || '3000', 10),
  n8nUrl: process.env.N8N_URL || defaultConfig.n8nUrl,
  n8nApiKey: process.env.N8N_API_KEY || defaultConfig.n8nApiKey,
  streamDeckPort: parseInt(
    process.env.STREAMDECK_PORT || '28472',
    10
  ),
});