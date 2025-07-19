import express from 'express';
import cors from 'cors';
import { getConfig } from '@n8n-streamdeck/config';
import { createStreamDeckAction } from '@n8n-streamdeck/shared';

const app = express();
const config = getConfig();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/actions', (req, res) => {
  const sampleAction = createStreamDeckAction(
    'trigger-workflow',
    'Trigger N8N Workflow'
  );
  res.json([sampleAction]);
});

app.listen(config.port, () => {
  console.log(`Backend server running on port ${config.port}`);
});