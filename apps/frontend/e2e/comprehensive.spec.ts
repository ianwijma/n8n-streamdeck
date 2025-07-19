import { test, expect } from '@playwright/test';
import { StreamDeckMockService } from './mocks/streamdeck-mock';
import { DeviceListPage } from './pages/DeviceListPage';
import { DeviceDetailPage } from './pages/DeviceDetailPage';
import { ButtonEditorPage } from './pages/ButtonEditorPage';
import { TestHelpers } from './utils/test-helpers';

test.describe('Comprehensive E2E Workflow', () => {
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
    await deviceListPage.goto();
  });

  test('complete StreamDeck workflow - device setup to button execution', async ({
    page,
  }) => {
    // Step 1: Verify initial state
    await test.step('Verify application loads correctly', async () => {
      await expect(page.locator('h1').first()).toBeVisible();
      await deviceListPage.expectDeviceCount(3);
    });

    // Step 2: Connect a device
    await test.step('Connect a disconnected device', async () => {
      await deviceListPage.expectDeviceStatus(1, 'Disconnected');
      await deviceListPage.connectDevice(1);
      await TestHelpers.waitForNetworkIdle(page);
      await deviceListPage.expectDeviceStatus(1, 'Connected');
    });

    // Step 3: Navigate to device details
    await test.step('Navigate to device configuration', async () => {
      await deviceListPage.clickDeviceCard(0);
      await deviceDetailPage.expectDeviceName('StreamDeck MK.2');
      await deviceDetailPage.expectButtonGridVisible();
      await deviceDetailPage.expectButtonCount(15);
    });

    // Step 4: Configure multiple button types
    await test.step('Configure webhook button', async () => {
      await deviceDetailPage.clickButtonSlot(0);
      await buttonEditorPage.expectModalVisible();

      await buttonEditorPage.fillButtonLabel('API Webhook');
      await buttonEditorPage.configureWebhookAction({
        url: 'https://httpbin.org/post',
        method: 'POST',
        payload: '{"action": "webhook_test", "timestamp": "{{timestamp}}"}',
        headers: { 'Content-Type': 'application/json' },
      });

      await buttonEditorPage.save();
      await buttonEditorPage.expectModalHidden();
      await deviceDetailPage.expectButtonLabel(0, 'API Webhook');
    });

    await test.step('Configure N8N workflow button', async () => {
      await deviceDetailPage.clickButtonSlot(1);
      await buttonEditorPage.expectModalVisible();

      await buttonEditorPage.fillButtonLabel('N8N Trigger');
      await buttonEditorPage.configureN8nWorkflowAction({
        workflowId: 'workflow-123',
        payload: '{"source": "streamdeck", "button": 1}',
      });

      await buttonEditorPage.save();
      await buttonEditorPage.expectModalHidden();
      await deviceDetailPage.expectButtonLabel(1, 'N8N Trigger');
    });

    await test.step('Configure hotkey button', async () => {
      await deviceDetailPage.clickButtonSlot(2);
      await buttonEditorPage.expectModalVisible();

      await buttonEditorPage.fillButtonLabel('Copy Paste');
      await buttonEditorPage.configureHotkeyAction('Control+c');

      await buttonEditorPage.save();
      await buttonEditorPage.expectModalHidden();
      await deviceDetailPage.expectButtonLabel(2, 'Copy Paste');
    });

    // Step 5: Test button execution
    await test.step('Test button press simulation', async () => {
      // Test webhook button
      await deviceDetailPage.doubleClickButtonSlot(0);
      await TestHelpers.waitForToastMessage(
        page,
        'Button executed successfully'
      );
      await TestHelpers.dismissToast(page);

      // Test N8N workflow button
      await deviceDetailPage.doubleClickButtonSlot(1);
      await TestHelpers.waitForToastMessage(page, 'Workflow triggered');
      await TestHelpers.dismissToast(page);
    });

    // Step 6: Edit existing button
    await test.step('Edit existing button configuration', async () => {
      await deviceDetailPage.clickButtonSlot(0);
      await buttonEditorPage.expectModalVisible();

      // Verify existing values are loaded
      await buttonEditorPage.expectFieldValue('title', 'API Webhook');
      await buttonEditorPage.expectFieldValue(
        'webhook-url',
        'https://httpbin.org/post'
      );

      // Update the configuration
      await buttonEditorPage.fillButtonLabel('Updated Webhook');
      await TestHelpers.fillWithRetry(
        page.locator('[data-testid="webhook-url-input"]'),
        'https://httpbin.org/put'
      );

      await buttonEditorPage.save();
      await buttonEditorPage.expectModalHidden();
      await deviceDetailPage.expectButtonLabel(0, 'Updated Webhook');
    });

    // Step 7: Test error handling
    await test.step('Test error handling', async () => {
      // Mock API error for button press
      await TestHelpers.mockApiError(
        page,
        'api/devices/*/buttons/*/press',
        'Button execution failed'
      );

      await deviceDetailPage.doubleClickButtonSlot(0);
      await TestHelpers.waitForToastMessage(page, 'Button execution failed');
      await TestHelpers.dismissToast(page);
    });

    // Step 8: Delete button
    await test.step('Delete button configuration', async () => {
      await deviceDetailPage.rightClickButtonSlot(2);
      await page.locator('[data-testid="delete-button-option"]').click();
      await page.locator('[data-testid="confirm-delete-button"]').click();

      await deviceDetailPage.expectEmptyButtonSlot(2);
    });

    // Step 9: Navigate back and verify persistence
    await test.step('Verify configuration persistence', async () => {
      await deviceDetailPage.goBack();
      await deviceListPage.expectDeviceCount(3);

      // Navigate back to device
      await deviceListPage.clickDeviceCard(0);
      await deviceDetailPage.expectButtonLabel(0, 'Updated Webhook');
      await deviceDetailPage.expectButtonLabel(1, 'N8N Trigger');
      await deviceDetailPage.expectEmptyButtonSlot(2);
    });

    // Step 10: Test device management
    await test.step('Test device disconnection', async () => {
      await deviceDetailPage.goBack();
      await deviceListPage.disconnectDevice(0);
      await TestHelpers.waitForNetworkIdle(page);
      await deviceListPage.expectDeviceStatus(0, 'Disconnected');
    });

    // Step 11: Final verification
    await test.step('Final state verification', async () => {
      // Verify all devices are still listed
      await deviceListPage.expectDeviceCount(3);

      // Verify filtering works
      await deviceListPage.filterDevices('connected');
      await deviceListPage.expectDeviceCount(1); // Only device-3 should be connected

      await deviceListPage.filterDevices('all');
      await deviceListPage.expectDeviceCount(3);

      // Take final screenshot
      await TestHelpers.takeScreenshotOnFailure(
        page,
        'comprehensive-workflow-complete'
      );
    });
  });

  test('multi-device configuration workflow', async ({ page }) => {
    await test.step('Add additional devices', async () => {
      // Add more devices for testing
      mockService.addDevice({
        name: 'StreamDeck Mini Test',
        model: 'streamdeck-mini',
        buttonCount: 6,
        connected: true,
      });
      mockService.addDevice({
        name: 'StreamDeck XL Test',
        model: 'streamdeck-xl',
        buttonCount: 32,
        connected: false,
      });

      await page.reload();
      await TestHelpers.waitForNetworkIdle(page);
      await deviceListPage.expectDeviceCount(5);
    });

    await test.step('Configure buttons on multiple devices', async () => {
      // Configure first device
      await deviceListPage.clickDeviceCard(0);
      await deviceDetailPage.clickButtonSlot(0);
      await buttonEditorPage.fillButtonLabel('Device 1 Button');
      await buttonEditorPage.configureWebhookAction({
        url: 'https://httpbin.org/device1',
      });
      await buttonEditorPage.save();

      // Go back and configure second device
      await deviceDetailPage.goBack();
      await deviceListPage.clickDeviceCard(3); // StreamDeck Mini Test
      await deviceDetailPage.expectButtonCount(6);

      await deviceDetailPage.clickButtonSlot(0);
      await buttonEditorPage.fillButtonLabel('Mini Device Button');
      await buttonEditorPage.configureWebhookAction({
        url: 'https://httpbin.org/mini',
      });
      await buttonEditorPage.save();

      await deviceDetailPage.expectButtonLabel(0, 'Mini Device Button');
    });

    await test.step('Test cross-device functionality', async () => {
      // Verify configurations are independent
      await deviceDetailPage.goBack();
      await deviceListPage.clickDeviceCard(0);
      await deviceDetailPage.expectButtonLabel(0, 'Device 1 Button');

      // Test button execution on different devices
      await deviceDetailPage.doubleClickButtonSlot(0);
      await TestHelpers.waitForToastMessage(
        page,
        'Button executed successfully'
      );
    });
  });

  test('stress test - rapid interactions', async ({ page }) => {
    await test.step('Rapid button configuration', async () => {
      await deviceListPage.clickDeviceCard(0);

      // Configure multiple buttons rapidly
      for (let i = 0; i < 5; i++) {
        await deviceDetailPage.clickButtonSlot(i);
        await buttonEditorPage.fillButtonLabel(`Rapid Button ${i}`);
        await buttonEditorPage.configureWebhookAction({
          url: `https://httpbin.org/rapid${i}`,
        });
        await buttonEditorPage.save();
        await TestHelpers.waitForNetworkIdle(page, 2000);
      }

      // Verify all buttons were configured
      for (let i = 0; i < 5; i++) {
        await deviceDetailPage.expectButtonLabel(i, `Rapid Button ${i}`);
      }
    });

    await test.step('Rapid button execution', async () => {
      // Execute multiple buttons in quick succession
      const pressPromises = [];
      for (let i = 0; i < 5; i++) {
        pressPromises.push(deviceDetailPage.doubleClickButtonSlot(i));
      }

      await Promise.all(pressPromises);

      // Verify all executions were handled
      await expect(
        page.locator('[data-testid="execution-counter"]')
      ).toContainText('5');
    });
  });
});
