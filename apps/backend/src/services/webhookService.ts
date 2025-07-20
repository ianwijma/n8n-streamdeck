import axios, { AxiosInstance } from 'axios';
import { Logger } from '@n8n-streamdeck/shared';
import { config } from '../config/environment';

const logger = new Logger({ level: config.logLevel }, 'WebhookService');

export interface WebhookRegistration {
  id: string;
  url: string;
  deviceId: string;
  buttonId?: string;
  events: string[];
  active: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ButtonPressEvent {
  event: 'pressed' | 'released';
  deviceId: string;
  buttonId?: string;
  position: number;
  timestamp: string;
  button?: any;
  device?: any;
}

export class WebhookService {
  private static instance: WebhookService;
  private webhooks: Map<string, WebhookRegistration> = new Map();
  private httpClient: AxiosInstance;

  private constructor() {
    this.httpClient = axios.create({
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'N8N-StreamDeck-Backend/1.0.0',
      },
    });
  }

  static getInstance(): WebhookService {
    if (!WebhookService.instance) {
      WebhookService.instance = new WebhookService();
    }
    return WebhookService.instance;
  }

  /**
   * Register a new webhook
   */
  registerWebhook(
    registration: Omit<WebhookRegistration, 'id' | 'createdAt' | 'updatedAt'>
  ): WebhookRegistration {
    const id = this.generateWebhookId();
    const webhook: WebhookRegistration = {
      ...registration,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.webhooks.set(id, webhook);

    logger.info('Webhook registered', {
      webhookId: id,
      url: webhook.url,
      deviceId: webhook.deviceId,
      buttonId: webhook.buttonId,
      events: webhook.events,
    });

    return webhook;
  }

  /**
   * Unregister a webhook
   */
  unregisterWebhook(webhookId: string): boolean {
    const webhook = this.webhooks.get(webhookId);
    if (webhook) {
      this.webhooks.delete(webhookId);
      logger.info('Webhook unregistered', { webhookId });
      return true;
    }
    return false;
  }

  /**
   * Get all webhooks
   */
  getWebhooks(): WebhookRegistration[] {
    return Array.from(this.webhooks.values());
  }

  /**
   * Get webhook by ID
   */
  getWebhook(webhookId: string): WebhookRegistration | undefined {
    return this.webhooks.get(webhookId);
  }

  /**
   * Update webhook
   */
  updateWebhook(
    webhookId: string,
    updates: Partial<WebhookRegistration>
  ): WebhookRegistration | undefined {
    const webhook = this.webhooks.get(webhookId);
    if (webhook) {
      const updatedWebhook = {
        ...webhook,
        ...updates,
        id: webhook.id, // Prevent ID changes
        createdAt: webhook.createdAt, // Prevent createdAt changes
        updatedAt: new Date(),
      };
      this.webhooks.set(webhookId, updatedWebhook);

      logger.info('Webhook updated', { webhookId });
      return updatedWebhook;
    }
    return undefined;
  }

  /**
   * Send button press event to matching webhooks
   */
  async sendButtonPressEvent(event: ButtonPressEvent): Promise<void> {
    const matchingWebhooks = this.findMatchingWebhooks(event);

    if (matchingWebhooks.length === 0) {
      logger.debug('No matching webhooks found for button press', {
        deviceId: event.deviceId,
        buttonId: event.buttonId,
        position: event.position,
        event: event.event,
      });
      return;
    }

    logger.info('Sending button press event to webhooks', {
      deviceId: event.deviceId,
      buttonId: event.buttonId,
      position: event.position,
      event: event.event,
      webhookCount: matchingWebhooks.length,
    });

    // Send to all matching webhooks in parallel
    const promises = matchingWebhooks.map((webhook) =>
      this.sendWebhookRequest(webhook, event)
    );

    await Promise.allSettled(promises);
  }

  /**
   * Find webhooks that match the button press event
   */
  private findMatchingWebhooks(event: ButtonPressEvent): WebhookRegistration[] {
    return Array.from(this.webhooks.values()).filter((webhook) => {
      // Skip inactive webhooks
      if (!webhook.active) {
        return false;
      }

      // Check if event type matches
      if (!webhook.events.includes(event.event)) {
        return false;
      }

      // Check device match
      if (webhook.deviceId !== '*' && webhook.deviceId !== event.deviceId) {
        return false;
      }

      // Check button match
      if (webhook.buttonId && webhook.buttonId !== '*') {
        // Handle position-based matching
        if (webhook.buttonId.startsWith('position:')) {
          const expectedPosition = parseInt(webhook.buttonId.split(':')[1], 10);
          return event.position === expectedPosition;
        }
        // Handle button ID matching
        return webhook.buttonId === event.buttonId;
      }

      return true;
    });
  }

  /**
   * Send HTTP request to webhook URL
   */
  private async sendWebhookRequest(
    webhook: WebhookRegistration,
    event: ButtonPressEvent
  ): Promise<void> {
    try {
      const payload = {
        ...event,
        webhookId: webhook.id,
        metadata: webhook.metadata,
      };

      await this.httpClient.post(webhook.url, payload);

      logger.debug('Webhook request sent successfully', {
        webhookId: webhook.id,
        url: webhook.url,
        deviceId: event.deviceId,
        buttonId: event.buttonId,
      });
    } catch (error) {
      logger.error('Failed to send webhook request', error as Error, {
        webhookId: webhook.id,
        url: webhook.url,
        deviceId: event.deviceId,
        buttonId: event.buttonId,
      });

      // Optionally disable webhook after multiple failures
      // This could be enhanced with retry logic and failure counting
    }
  }

  /**
   * Generate unique webhook ID
   */
  private generateWebhookId(): string {
    return `webhook_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Clean up inactive or expired webhooks
   */
  cleanup(): void {
    const now = new Date();
    const expiredWebhooks: string[] = [];

    for (const [id, webhook] of this.webhooks.entries()) {
      // Remove webhooks older than 30 days that are inactive
      const daysSinceUpdate =
        (now.getTime() - webhook.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (!webhook.active && daysSinceUpdate > 30) {
        expiredWebhooks.push(id);
      }
    }

    expiredWebhooks.forEach((id) => {
      this.webhooks.delete(id);
      logger.info('Expired webhook removed', { webhookId: id });
    });

    if (expiredWebhooks.length > 0) {
      logger.info('Webhook cleanup completed', {
        removedCount: expiredWebhooks.length,
      });
    }
  }
}
