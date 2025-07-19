import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class ButtonEditorPage extends BasePage {
  private readonly modal: Locator;
  private readonly titleInput: Locator;
  private readonly actionTypeSelect: Locator;
  private readonly saveButton: Locator;
  private readonly cancelButton: Locator;
  private readonly deleteButton: Locator;

  // Webhook action fields
  private readonly webhookUrlInput: Locator;
  private readonly webhookMethodSelect: Locator;
  private readonly webhookPayloadTextarea: Locator;
  private readonly addHeaderButton: Locator;
  private readonly headerKeyInput: Locator;
  private readonly headerValueInput: Locator;

  // N8N workflow action fields
  private readonly workflowIdInput: Locator;
  private readonly workflowPayloadTextarea: Locator;

  // Hotkey action fields
  private readonly hotkeyInput: Locator;
  private readonly hotkeyDisplay: Locator;

  // System command action fields
  private readonly commandInput: Locator;
  private readonly argsInput: Locator;
  private readonly workingDirInput: Locator;

  // Text input action fields
  private readonly textInput: Locator;
  private readonly delayInput: Locator;

  constructor(page: Page) {
    super(page);
    this.modal = page.locator('[data-testid="button-editor-modal"]');
    this.titleInput = page.locator('[data-testid="button-label-input"]');
    this.actionTypeSelect = page.locator('[data-testid="action-type-select"]');
    this.saveButton = page.locator('[data-testid="save-button"]');
    this.cancelButton = page.locator('[data-testid="cancel-button"]');
    this.deleteButton = page.locator('[data-testid="delete-button-option"]');

    // Webhook fields
    this.webhookUrlInput = page.locator('[data-testid="webhook-url-input"]');
    this.webhookMethodSelect = page.locator(
      '[data-testid="webhook-method-select"]'
    );
    this.webhookPayloadTextarea = page.locator(
      '[data-testid="webhook-payload-textarea"]'
    );
    this.addHeaderButton = page.locator('[data-testid="add-header-button"]');
    this.headerKeyInput = page.locator('[data-testid="header-key-input"]');
    this.headerValueInput = page.locator('[data-testid="header-value-input"]');

    // N8N workflow fields
    this.workflowIdInput = page.locator('[data-testid="workflow-id-input"]');
    this.workflowPayloadTextarea = page.locator(
      '[data-testid="workflow-payload-textarea"]'
    );

    // Hotkey fields
    this.hotkeyInput = page.locator('[data-testid="hotkey-input"]');
    this.hotkeyDisplay = page.locator('[data-testid="hotkey-display"]');

    // System command fields
    this.commandInput = page.locator('[data-testid="command-input"]');
    this.argsInput = page.locator('[data-testid="args-input"]');
    this.workingDirInput = page.locator('[data-testid="working-dir-input"]');

    // Text input fields
    this.textInput = page.locator('[data-testid="text-input"]');
    this.delayInput = page.locator('[data-testid="delay-input"]');
  }

  async expectModalVisible() {
    await expect(this.modal).toBeVisible();
  }

  async expectModalHidden() {
    await expect(this.modal).not.toBeVisible();
  }

  async expectTitle(title: string) {
    await expect(
      this.page.locator('[data-testid="button-editor-title"]')
    ).toContainText(title);
  }

  async fillButtonLabel(label: string) {
    await this.titleInput.fill(label);
  }

  async selectActionType(
    type:
      | 'webhook'
      | 'n8n-workflow'
      | 'hotkey'
      | 'system-command'
      | 'text-input'
  ) {
    await this.actionTypeSelect.selectOption(type);
  }

  async configureWebhookAction(config: {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    payload?: string;
    headers?: Record<string, string>;
  }) {
    await this.selectActionType('webhook');
    await this.webhookUrlInput.fill(config.url);

    if (config.method) {
      await this.webhookMethodSelect.selectOption(config.method);
    }

    if (config.payload) {
      await this.webhookPayloadTextarea.fill(config.payload);
    }

    if (config.headers) {
      for (const [key, value] of Object.entries(config.headers)) {
        await this.addHeaderButton.click();
        await this.headerKeyInput.fill(key);
        await this.headerValueInput.fill(value);
      }
    }
  }

  async configureN8nWorkflowAction(config: {
    workflowId: string;
    payload?: string;
  }) {
    await this.selectActionType('n8n-workflow');
    await this.workflowIdInput.fill(config.workflowId);

    if (config.payload) {
      await this.workflowPayloadTextarea.fill(config.payload);
    }
  }

  async configureHotkeyAction(keys: string) {
    await this.selectActionType('hotkey');
    await this.hotkeyInput.click();
    await this.page.keyboard.press(keys);
  }

  async configureSystemCommandAction(config: {
    command: string;
    args?: string;
    workingDir?: string;
  }) {
    await this.selectActionType('system-command');
    await this.commandInput.fill(config.command);

    if (config.args) {
      await this.argsInput.fill(config.args);
    }

    if (config.workingDir) {
      await this.workingDirInput.fill(config.workingDir);
    }
  }

  async configureTextInputAction(config: { text: string; delay?: string }) {
    await this.selectActionType('text-input');
    await this.textInput.fill(config.text);

    if (config.delay) {
      await this.delayInput.fill(config.delay);
    }
  }

  async save() {
    await this.saveButton.click();
  }

  async cancel() {
    await this.cancelButton.click();
  }

  async delete() {
    await this.deleteButton.click();
    // Confirm deletion
    await this.page.locator('[data-testid="confirm-delete-button"]').click();
  }

  async expectValidationError(message: string) {
    await expect(
      this.page.locator('[data-testid="validation-error"]')
    ).toContainText(message);
  }

  async expectHotkeyDisplay(keys: string) {
    await expect(this.hotkeyDisplay).toContainText(keys);
  }

  async expectFieldValue(
    field: 'title' | 'webhook-url' | 'workflow-id',
    value: string
  ) {
    const fieldMap = {
      title: this.titleInput,
      'webhook-url': this.webhookUrlInput,
      'workflow-id': this.workflowIdInput,
    };

    await expect(fieldMap[field]).toHaveValue(value);
  }
}
