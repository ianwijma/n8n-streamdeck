import { test, expect } from '@playwright/test';
import { StreamDeckMockService } from './mocks/streamdeck-mock';
import { DeviceListPage } from './pages/DeviceListPage';
import { DeviceDetailPage } from './pages/DeviceDetailPage';
import { ButtonEditorPage } from './pages/ButtonEditorPage';

test.describe('N8N Integration E2E', () => {
  let mockService: StreamDeckMockService;
  let deviceListPage: DeviceListPage;
  let deviceDetailPage: DeviceDetailPage;
  let buttonEditorPage: ButtonEditorPage;

  test.beforeEach(async ({ page }) => {
    mockService = new StreamDeckMockService(page);
    deviceListPage = new DeviceListPage(page);
    deviceDetailPage = new DeviceDetailPage(page);
    buttonEditorPage = new ButtonEditorPage(page);

    await mockService.setupMocks();

    // Mock N8N API endpoints
    await page.route('**/api/n8n/workflows', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'workflow-123',
              name: 'StreamDeck Test Workflow',
              active: true,
              webhookUrl: 'https://n8n.example.com/webhook/streamdeck-123',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            {
              id: 'workflow-456',
              name: 'Email Notification Workflow',
              active: true,
              webhookUrl: 'https://n8n.example.com/webhook/email-456',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    // Mock N8N workflow execution
    await page.route('**/api/n8n/workflows/*/execute', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            executionId: `exec-${Date.now()}`,
            status: 'running',
            startedAt: new Date().toISOString(),
          },
        }),
      });
    });

    // Mock N8N webhook trigger
    await page.route('https://n8n.example.com/webhook/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Workflow triggered successfully',
          executionId: `exec-${Date.now()}`,
        }),
      });
    });

    await deviceListPage.goto();
  });

  test('should configure N8N workflow button', async () => {
    // Navigate to device detail page
    await deviceListPage.clickDeviceCard(0);
    await deviceDetailPage.expectDeviceName('StreamDeck MK.2');

    // Click on empty button slot
    await deviceDetailPage.clickButtonSlot(0);
    await buttonEditorPage.expectModalVisible();

    // Configure N8N workflow button
    await buttonEditorPage.fillButtonLabel('Trigger N8N Workflow');
    await buttonEditorPage.configureN8nWorkflowAction({
      workflowId: 'workflow-123',
      payload: '{"source": "streamdeck", "buttonIndex": 0}',
    });

    // Save the configuration
    await buttonEditorPage.save();
    await buttonEditorPage.expectModalHidden();

    // Verify button is configured
    await deviceDetailPage.expectButtonLabel(0, 'Trigger N8N Workflow');
    await deviceDetailPage.expectButtonType(0, 'workflow');
  });

  test('should execute N8N workflow on button press', async ({ page }) => {
    // Add a pre-configured N8N workflow button
    mockService.addButton('device-1', {
      position: 0,
      title: 'N8N Test Button',
      action: {
        type: 'n8n-workflow',
        config: {
          workflowId: 'workflow-123',
          webhookUrl: 'https://n8n.example.com/webhook/streamdeck-123',
          payload: { source: 'streamdeck' },
        },
      },
    });

    // Navigate to device detail page
    await deviceListPage.clickDeviceCard(0);
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Double-click button to simulate press
    await deviceDetailPage.doubleClickButtonSlot(0);

    // Verify execution feedback
    await deviceDetailPage.expectButtonPressFeedback();
    await expect(
      page.locator('[data-testid="button-press-feedback"]')
    ).toContainText('Workflow executed successfully');
  });

  test('should handle N8N workflow execution errors', async ({ page }) => {
    // Mock N8N webhook error
    await page.route('https://n8n.example.com/webhook/**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Workflow execution failed',
        }),
      });
    });

    // Add a pre-configured N8N workflow button
    mockService.addButton('device-1', {
      position: 0,
      title: 'Failing N8N Button',
      action: {
        type: 'n8n-workflow',
        config: {
          workflowId: 'workflow-123',
          webhookUrl: 'https://n8n.example.com/webhook/streamdeck-123',
          payload: { source: 'streamdeck' },
        },
      },
    });

    // Navigate to device detail page
    await deviceListPage.clickDeviceCard(0);
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Double-click button to simulate press
    await deviceDetailPage.doubleClickButtonSlot(0);

    // Verify error feedback
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText(
      'Workflow execution failed'
    );
  });

  test('should validate N8N workflow configuration', async ({ page }) => {
    // Navigate to device detail page
    await deviceListPage.clickDeviceCard(0);
    await deviceDetailPage.expectDeviceName('StreamDeck MK.2');

    // Click on empty button slot
    await deviceDetailPage.clickButtonSlot(0);
    await buttonEditorPage.expectModalVisible();

    // Try to save N8N workflow without required fields
    await buttonEditorPage.fillButtonLabel('Test N8N Button');
    await buttonEditorPage.selectActionType('n8n-workflow');
    await buttonEditorPage.save();

    // Verify validation errors
    await buttonEditorPage.expectValidationError('Workflow ID is required');

    // Fill workflow ID but leave webhook URL empty
    await page
      .locator('[data-testid="workflow-id-input"]')
      .fill('workflow-123');
    await buttonEditorPage.save();

    // Should succeed as webhook URL can be auto-generated
    await buttonEditorPage.expectModalHidden();
  });

  test('should display available N8N workflows', async ({ page }) => {
    // Navigate to device detail page
    await deviceListPage.clickDeviceCard(0);
    await deviceDetailPage.expectDeviceName('StreamDeck MK.2');

    // Click on empty button slot
    await deviceDetailPage.clickButtonSlot(0);
    await buttonEditorPage.expectModalVisible();

    // Select N8N workflow action type
    await buttonEditorPage.selectActionType('n8n-workflow');

    // Check if workflow dropdown is populated
    const workflowSelect = page.locator('[data-testid="workflow-select"]');
    await expect(workflowSelect).toBeVisible();

    // Verify workflow options are available
    await workflowSelect.click();
    await expect(
      page.locator('option:has-text("StreamDeck Test Workflow")')
    ).toBeVisible();
    await expect(
      page.locator('option:has-text("Email Notification Workflow")')
    ).toBeVisible();
  });

  test('should auto-generate webhook URL from workflow selection', async ({
    page,
  }) => {
    // Navigate to device detail page
    await deviceListPage.clickDeviceCard(0);
    await deviceDetailPage.expectDeviceName('StreamDeck MK.2');

    // Click on empty button slot
    await deviceDetailPage.clickButtonSlot(0);
    await buttonEditorPage.expectModalVisible();

    // Select N8N workflow action type
    await buttonEditorPage.selectActionType('n8n-workflow');

    // Select a workflow from dropdown
    const workflowSelect = page.locator('[data-testid="workflow-select"]');
    await workflowSelect.selectOption('workflow-123');

    // Verify webhook URL is auto-populated
    const webhookUrlInput = page.locator('[data-testid="webhook-url-input"]');
    await expect(webhookUrlInput).toHaveValue(
      'https://n8n.example.com/webhook/streamdeck-123'
    );
  });

  test('should test N8N workflow connection', async ({ page }) => {
    // Navigate to device detail page
    await deviceListPage.clickDeviceCard(0);
    await deviceDetailPage.expectDeviceName('StreamDeck MK.2');

    // Click on empty button slot
    await deviceDetailPage.clickButtonSlot(0);
    await buttonEditorPage.expectModalVisible();

    // Configure N8N workflow
    await buttonEditorPage.fillButtonLabel('Test Connection');
    await buttonEditorPage.configureN8nWorkflowAction({
      workflowId: 'workflow-123',
      payload: '{"test": true}',
    });

    // Click test connection button
    await page.locator('[data-testid="test-connection-button"]').click();

    // Verify test result
    await expect(page.locator('[data-testid="test-result"]')).toBeVisible();
    await expect(page.locator('[data-testid="test-result"]')).toContainText(
      'Connection successful'
    );
  });

  test('should handle N8N configuration errors', async ({ page }) => {
    // Mock N8N API error
    await page.route('**/api/n8n/workflows', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'N8N service unavailable',
        }),
      });
    });

    // Navigate to device detail page
    await deviceListPage.clickDeviceCard(0);
    await deviceDetailPage.expectDeviceName('StreamDeck MK.2');

    // Click on empty button slot
    await deviceDetailPage.clickButtonSlot(0);
    await buttonEditorPage.expectModalVisible();

    // Select N8N workflow action type
    await buttonEditorPage.selectActionType('n8n-workflow');

    // Verify error message is displayed
    await expect(page.locator('[data-testid="n8n-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="n8n-error"]')).toContainText(
      'Unable to load N8N workflows'
    );
  });

  test('should support N8N workflow payload templating', async () => {
    // Navigate to device detail page
    await deviceListPage.clickDeviceCard(0);
    await deviceDetailPage.expectDeviceName('StreamDeck MK.2');

    // Click on empty button slot
    await deviceDetailPage.clickButtonSlot(0);
    await buttonEditorPage.expectModalVisible();

    // Configure N8N workflow with templated payload
    await buttonEditorPage.fillButtonLabel('Templated Workflow');
    await buttonEditorPage.configureN8nWorkflowAction({
      workflowId: 'workflow-123',
      payload:
        '{"timestamp": "{{timestamp}}", "deviceId": "{{deviceId}}", "buttonIndex": "{{buttonIndex}}"}',
    });

    // Save configuration
    await buttonEditorPage.save();
    await buttonEditorPage.expectModalHidden();

    // Verify button is configured
    await deviceDetailPage.expectButtonLabel(0, 'Templated Workflow');
  });

  test('should monitor N8N workflow execution status', async ({ page }) => {
    // Mock workflow execution status endpoint
    await page.route('**/api/n8n/executions/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'exec-123',
            status: 'success',
            startedAt: new Date(Date.now() - 5000).toISOString(),
            finishedAt: new Date().toISOString(),
            duration: 5000,
          },
        }),
      });
    });

    // Add a pre-configured N8N workflow button
    mockService.addButton('device-1', {
      position: 0,
      title: 'Monitored Workflow',
      action: {
        type: 'n8n-workflow',
        config: {
          workflowId: 'workflow-123',
          webhookUrl: 'https://n8n.example.com/webhook/streamdeck-123',
          payload: { source: 'streamdeck' },
        },
      },
    });

    // Navigate to device detail page
    await deviceListPage.clickDeviceCard(0);
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Double-click button to simulate press
    await deviceDetailPage.doubleClickButtonSlot(0);

    // Verify execution status is shown
    await expect(
      page.locator('[data-testid="execution-status"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="execution-status"]')
    ).toContainText('Running');

    // Wait for execution to complete
    await page.waitForTimeout(2000);
    await expect(
      page.locator('[data-testid="execution-status"]')
    ).toContainText('Completed');
  });
});
