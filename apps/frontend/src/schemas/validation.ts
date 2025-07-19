import { z } from 'zod';

// Button Configuration Schema
export const buttonConfigSchema = z.object({
  title: z.string().max(20, 'Title must be 20 characters or less').optional(),
  backgroundColor: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, 'Invalid color format')
    .optional(),
  textColor: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, 'Invalid color format')
    .optional(),
  fontSize: z
    .number()
    .min(8, 'Font size must be at least 8')
    .max(24, 'Font size must be at most 24')
    .optional(),
  enabled: z.boolean().default(true),
  position: z.number().min(0, 'Position must be non-negative'),
});

// Webhook Action Schema
export const webhookActionSchema = z.object({
  type: z.literal('webhook'),
  config: z.object({
    url: z.string().url({ message: 'Invalid URL format' }),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('POST'),
    headers: z.record(z.string(), z.string()).optional(),
    body: z.string().optional(),
  }),
});

// N8N Workflow Action Schema
export const n8nWorkflowActionSchema = z.object({
  type: z.literal('n8n-workflow'),
  config: z.object({
    workflowId: z.string().min(1, 'Workflow ID is required'),
    webhookUrl: z.string().url({ message: 'Invalid webhook URL' }),
    payload: z.record(z.string(), z.any()).optional(),
  }),
});

// System Command Action Schema
export const systemCommandActionSchema = z.object({
  type: z.literal('system-command'),
  config: z.object({
    command: z.string().min(1, 'Command is required'),
    args: z.array(z.string()).optional(),
    workingDirectory: z.string().optional(),
  }),
});

// Hotkey Action Schema
export const hotkeyActionSchema = z.object({
  type: z.literal('hotkey'),
  config: z.object({
    keys: z.array(z.string()).min(1, 'At least one key is required'),
    modifiers: z.array(z.enum(['ctrl', 'alt', 'shift', 'meta'])).optional(),
  }),
});

// Text Input Action Schema
export const textInputActionSchema = z.object({
  type: z.literal('text-input'),
  config: z.object({
    text: z.string().min(1, 'Text is required'),
    delay: z.number().min(0, 'Delay must be non-negative').optional(),
  }),
});

// Combined Action Schema
export const buttonActionSchema = z.discriminatedUnion('type', [
  webhookActionSchema,
  n8nWorkflowActionSchema,
  systemCommandActionSchema,
  hotkeyActionSchema,
  textInputActionSchema,
]);

// Complete Button Schema
export const buttonSchema = buttonConfigSchema.extend({
  action: buttonActionSchema.optional(),
});

// Device Update Schema
export const deviceUpdateSchema = z.object({
  name: z
    .string()
    .min(1, 'Device name is required')
    .max(50, 'Device name must be 50 characters or less'),
});

// App Configuration Schema
export const appConfigSchema = z.object({
  autoConnect: z.boolean().default(true),
  connectionTimeout: z
    .number()
    .min(5, 'Timeout must be at least 5 seconds')
    .max(120, 'Timeout must be at most 120 seconds')
    .default(30),
  n8nBaseUrl: z.string().url({ message: 'Invalid N8N URL' }).optional(),
  n8nApiKey: z.string().optional(),
  defaultButtonBackgroundColor: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, 'Invalid color format')
    .default('#000000'),
  defaultTextColor: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, 'Invalid color format')
    .default('#ffffff'),
  defaultFontSize: z.number().min(8).max(24).default(12),
});

// Form Validation Schemas (for react-hook-form)
export const buttonFormSchema = z
  .object({
    title: z.string().max(20).optional(),
    backgroundColor: z
      .string()
      .regex(/^#[0-9A-F]{6}$/i)
      .optional(),
    textColor: z
      .string()
      .regex(/^#[0-9A-F]{6}$/i)
      .optional(),
    fontSize: z.number().min(8).max(24).optional(),
    enabled: z.boolean(),
    actionType: z
      .enum([
        'webhook',
        'n8n-workflow',
        'system-command',
        'hotkey',
        'text-input',
      ])
      .optional(),

    // Webhook fields
    webhookUrl: z.string().url({ message: 'Invalid URL' }).optional(),
    webhookMethod: z.enum(['GET', 'POST', 'PUT', 'DELETE']).optional(),
    webhookHeaders: z.string().optional(),
    webhookBody: z.string().optional(),

    // N8N fields
    n8nWorkflowId: z.string().optional(),
    n8nWebhookUrl: z.string().url({ message: 'Invalid URL' }).optional(),
    n8nPayload: z.string().optional(),

    // System command fields
    systemCommand: z.string().optional(),
    systemArgs: z.string().optional(),

    // Hotkey fields
    hotkeyKeys: z.string().optional(),

    // Text input fields
    textInput: z.string().optional(),
  })
  .refine(
    (data) => {
      // Custom validation based on action type
      if (!data.actionType) return true;

      switch (data.actionType) {
        case 'webhook':
          return !!data.webhookUrl;
        case 'n8n-workflow':
          return !!data.n8nWorkflowId && !!data.n8nWebhookUrl;
        case 'system-command':
          return !!data.systemCommand;
        case 'hotkey':
          return !!data.hotkeyKeys;
        case 'text-input':
          return !!data.textInput;
        default:
          return true;
      }
    },
    {
      message: 'Required fields for the selected action type are missing',
      path: ['actionType'],
    }
  );

// Type exports
export type ButtonConfigInput = z.infer<typeof buttonConfigSchema>;
export type ButtonActionInput = z.infer<typeof buttonActionSchema>;
export type ButtonInput = z.infer<typeof buttonSchema>;
export type DeviceUpdateInput = z.infer<typeof deviceUpdateSchema>;
export type AppConfigInput = z.infer<typeof appConfigSchema>;
export type ButtonFormInput = z.infer<typeof buttonFormSchema>;
