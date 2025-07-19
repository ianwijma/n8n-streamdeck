import { test, expect } from '@playwright/test';
import { StreamDeckMockService } from './mocks/streamdeck-mock';
import { DeviceListPage } from './pages/DeviceListPage';
import { DeviceDetailPage } from './pages/DeviceDetailPage';
import { ButtonEditorPage } from './pages/ButtonEditorPage';

test.describe('Advanced E2E Scenarios', () => {
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

  test.describe('Multi-Device Management', () => {
    test('should handle multiple devices simultaneously', async ({ page }) => {
      // Add multiple devices
      mockService.addDevice({ name: 'StreamDeck 1', connected: true });
      mockService.addDevice({ name: 'StreamDeck 2', connected: false });
      mockService.addDevice({ name: 'StreamDeck 3', connected: true });

      await page.reload();
      await page.waitForLoadState('networkidle');

      // Verify all devices are displayed
      await deviceListPage.expectDeviceCount(6); // 3 original + 3 new

      // Connect the disconnected device
      const disconnectedCard =
        await deviceListPage.getDeviceCardByName('StreamDeck 2');
      await disconnectedCard.locator('[data-testid="connect-button"]').click();

      // Verify device status updates
      await deviceListPage.waitForDeviceUpdate('StreamDeck 2', 'Connected');
    });

    test('should sync button configurations across devices', async ({
      page,
    }) => {
      // Configure a button on first device
      await deviceListPage.clickDeviceCard(0);
      await deviceDetailPage.clickButtonSlot(0);
      await buttonEditorPage.fillButtonLabel('Shared Button');
      await buttonEditorPage.configureWebhookAction({
        url: 'https://httpbin.org/post',
        method: 'POST',
      });
      await buttonEditorPage.save();

      // Navigate to second device
      await deviceDetailPage.goBack();
      await deviceListPage.clickDeviceCard(1);

      // Verify button configuration can be copied
      await page.locator('[data-testid="copy-config-button"]').click();
      await page
        .locator('[data-testid="source-device-select"]')
        .selectOption('device-1');
      await page
        .locator('[data-testid="source-button-select"]')
        .selectOption('0');
      await page
        .locator('[data-testid="target-button-select"]')
        .selectOption('0');
      await page.locator('[data-testid="confirm-copy-button"]').click();

      // Verify button was copied
      await deviceDetailPage.expectButtonLabel(0, 'Shared Button');
    });

    test('should handle device disconnection gracefully', async ({ page }) => {
      // Start with connected device
      await deviceListPage.expectDeviceStatus(0, 'Connected');

      // Simulate device disconnection
      mockService.simulateDeviceEvent('device-disconnected', 'device-1');

      // Verify UI updates
      await deviceListPage.waitForDeviceUpdate(
        'StreamDeck MK.2',
        'Disconnected'
      );

      // Try to interact with disconnected device
      await deviceListPage.clickDeviceCard(0);
      await expect(
        page.locator('[data-testid="device-offline-warning"]')
      ).toBeVisible();
    });
  });

  test.describe('Real-time Updates', () => {
    test('should sync updates across multiple browser tabs', async ({
      context,
    }) => {
      // Open second tab
      const secondPage = await context.newPage();
      const secondMockService = new StreamDeckMockService(secondPage);
      const secondDeviceListPage = new DeviceListPage(secondPage);

      await secondMockService.setupMocks();
      await secondDeviceListPage.goto();

      // Configure button in first tab
      await deviceListPage.clickDeviceCard(0);
      await deviceDetailPage.clickButtonSlot(0);
      await buttonEditorPage.fillButtonLabel('Multi-tab Button');
      await buttonEditorPage.configureWebhookAction({
        url: 'https://httpbin.org/post',
      });
      await buttonEditorPage.save();

      // Verify update appears in second tab
      await secondDeviceListPage.clickDeviceCard(0);
      const secondDeviceDetailPage = new DeviceDetailPage(secondPage);
      await secondDeviceDetailPage.expectButtonLabel(0, 'Multi-tab Button');

      await secondPage.close();
    });

    test('should handle WebSocket reconnection', async ({ page }) => {
      // Simulate WebSocket disconnection
      await page.evaluate(() => {
        const socket = (window as any).socket;
        if (socket) {
          socket.disconnect();
        }
      });

      // Verify reconnection indicator
      await expect(
        page.locator('[data-testid="connection-status"]')
      ).toContainText('Reconnecting');

      // Simulate reconnection
      await page.evaluate(() => {
        const callbacks = (window as any).socketCallbacks;
        if (callbacks && callbacks.connect) {
          callbacks.connect();
        }
      });

      // Verify connection restored
      await expect(
        page.locator('[data-testid="connection-status"]')
      ).toContainText('Connected');
    });

    test('should handle real-time button press events', async ({ page }) => {
      // Navigate to device detail page
      await deviceListPage.clickDeviceCard(0);

      // Simulate button press from external source
      mockService.simulateButtonPress('device-1', 0);

      // Verify visual feedback
      await expect(
        page.locator('[data-testid="button-slot"]:first-child')
      ).toHaveClass(/pressed/);

      // Wait for press animation to complete
      await page.waitForTimeout(500);
      await expect(
        page.locator('[data-testid="button-slot"]:first-child')
      ).not.toHaveClass(/pressed/);
    });
  });

  test.describe('Error Recovery and Retry Logic', () => {
    test('should retry failed API requests', async ({ page }) => {
      let requestCount = 0;

      // Mock API to fail first two requests, succeed on third
      await page.route('**/api/devices', async (route) => {
        requestCount++;
        if (requestCount <= 2) {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              error: 'Server error',
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: [],
            }),
          });
        }
      });

      // Reload page to trigger API request
      await page.reload();

      // Verify retry indicator is shown
      await expect(
        page.locator('[data-testid="retry-indicator"]')
      ).toBeVisible();

      // Wait for successful retry
      await page.waitForTimeout(3000);
      await expect(
        page.locator('[data-testid="retry-indicator"]')
      ).not.toBeVisible();

      // Verify request succeeded after retries
      expect(requestCount).toBe(3);
    });

    test('should handle network connectivity issues', async ({ page }) => {
      // Simulate network offline
      await page.context().setOffline(true);

      // Try to perform action
      await deviceListPage.refreshDeviceList();

      // Verify offline indicator
      await expect(
        page.locator('[data-testid="offline-indicator"]')
      ).toBeVisible();

      // Restore network
      await page.context().setOffline(false);

      // Verify automatic retry when back online
      await expect(
        page.locator('[data-testid="offline-indicator"]')
      ).not.toBeVisible();
      await deviceListPage.expectDeviceCount(3);
    });

    test('should recover from button configuration errors', async ({
      page,
    }) => {
      // Navigate to device and open button editor
      await deviceListPage.clickDeviceCard(0);
      await deviceDetailPage.clickButtonSlot(0);

      // Mock save API to fail
      await page.route('**/api/devices/*/buttons/*', async (route) => {
        if (route.request().method() === 'PUT') {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              error: 'Configuration save failed',
            }),
          });
        }
      });

      // Try to save configuration
      await buttonEditorPage.fillButtonLabel('Test Button');
      await buttonEditorPage.configureWebhookAction({
        url: 'https://httpbin.org/post',
      });
      await buttonEditorPage.save();

      // Verify error is shown and modal stays open
      await buttonEditorPage.expectModalVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText(
        'Configuration save failed'
      );

      // Fix the API and retry
      await page.unroute('**/api/devices/*/buttons/*');
      await mockService.setupMocks();

      await buttonEditorPage.save();
      await buttonEditorPage.expectModalHidden();
    });
  });

  test.describe('Performance and Load Testing', () => {
    test('should handle rapid button presses', async ({ page }) => {
      // Add multiple configured buttons
      for (let i = 0; i < 5; i++) {
        mockService.addButton('device-1', {
          position: i,
          title: `Button ${i}`,
          action: {
            type: 'webhook',
            config: {
              url: 'https://httpbin.org/post',
              method: 'POST',
            },
          },
        });
      }

      await deviceListPage.clickDeviceCard(0);
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Rapidly press multiple buttons
      const pressPromises = [];
      for (let i = 0; i < 5; i++) {
        pressPromises.push(deviceDetailPage.doubleClickButtonSlot(i));
      }

      await Promise.all(pressPromises);

      // Verify all presses were handled
      await expect(page.locator('[data-testid="press-counter"]')).toContainText(
        '5'
      );
    });

    test('should handle large device configurations', async ({ page }) => {
      // Add device with maximum buttons (32 for XL)
      const xlDevice = mockService.addDevice({
        name: 'StreamDeck XL',
        model: 'streamdeck-xl',
        buttonCount: 32,
        columns: 8,
        rows: 4,
      });

      // Add buttons to all slots
      for (let i = 0; i < 32; i++) {
        mockService.addButton(xlDevice.id, {
          position: i,
          title: `Button ${i}`,
          action: {
            type: 'webhook',
            config: {
              url: `https://httpbin.org/post/${i}`,
              method: 'POST',
            },
          },
        });
      }

      await page.reload();
      await deviceListPage.clickDeviceCardByName('StreamDeck XL');

      // Verify all buttons load correctly
      await deviceDetailPage.expectButtonCount(32);

      // Verify scrolling works for large grids
      await page
        .locator('[data-testid="button-grid"]')
        .scrollIntoViewIfNeeded();
      await deviceDetailPage.expectButtonLabel(31, 'Button 31');
    });
  });

  test.describe('Accessibility and Usability', () => {
    test('should support keyboard navigation', async ({ page }) => {
      await deviceListPage.goto();

      // Navigate using keyboard
      await page.keyboard.press('Tab'); // Focus first device card
      await page.keyboard.press('Enter'); // Open device

      // Verify navigation worked
      await deviceDetailPage.expectDeviceName('StreamDeck MK.2');

      // Navigate button grid with keyboard
      await page.keyboard.press('Tab'); // Focus first button
      await page.keyboard.press('Enter'); // Open button editor

      await buttonEditorPage.expectModalVisible();
    });

    test('should provide proper ARIA labels and roles', async ({ page }) => {
      await deviceListPage.goto();

      // Check device list accessibility
      const deviceList = page.locator('[data-testid="device-list"]');
      await expect(deviceList).toHaveAttribute('role', 'list');

      const deviceCards = await deviceListPage.getDeviceCards();
      await expect(deviceCards.first()).toHaveAttribute('role', 'listitem');

      // Navigate to device detail
      await deviceListPage.clickDeviceCard(0);

      // Check button grid accessibility
      const buttonGrid = page.locator('[data-testid="button-grid"]');
      await expect(buttonGrid).toHaveAttribute('role', 'grid');

      const buttonSlots = await deviceDetailPage.getButtonSlots();
      await expect(buttonSlots.first()).toHaveAttribute('role', 'gridcell');
    });

    test('should work with screen readers', async () => {
      await deviceListPage.goto();

      // Verify screen reader announcements
      const deviceCard = await deviceListPage.getDeviceCard(0);
      await expect(deviceCard).toHaveAttribute('aria-label');

      const ariaLabel = await deviceCard.getAttribute('aria-label');
      expect(ariaLabel).toContain('StreamDeck MK.2');
      expect(ariaLabel).toContain('Connected');
    });
  });

  test.describe('Data Persistence and State Management', () => {
    test('should persist button configurations across sessions', async ({
      page,
    }) => {
      // Configure a button
      await deviceListPage.clickDeviceCard(0);
      await deviceDetailPage.clickButtonSlot(0);
      await buttonEditorPage.fillButtonLabel('Persistent Button');
      await buttonEditorPage.configureWebhookAction({
        url: 'https://httpbin.org/post',
      });
      await buttonEditorPage.save();

      // Simulate page refresh (new session)
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Verify configuration persisted
      await deviceListPage.clickDeviceCard(0);
      await deviceDetailPage.expectButtonLabel(0, 'Persistent Button');
    });

    test('should handle concurrent configuration changes', async ({
      context,
    }) => {
      // Open two tabs
      const page1 = await context.newPage();
      const page2 = await context.newPage();

      const mockService1 = new StreamDeckMockService(page1);
      const mockService2 = new StreamDeckMockService(page2);

      await mockService1.setupMocks();
      await mockService2.setupMocks();

      const deviceListPage1 = new DeviceListPage(page1);
      const deviceListPage2 = new DeviceListPage(page2);

      await deviceListPage1.goto();
      await deviceListPage2.goto();

      // Configure button in first tab
      await deviceListPage1.clickDeviceCard(0);
      const deviceDetailPage1 = new DeviceDetailPage(page1);
      await deviceDetailPage1.clickButtonSlot(0);
      const buttonEditorPage1 = new ButtonEditorPage(page1);
      await buttonEditorPage1.fillButtonLabel('Tab 1 Button');
      await buttonEditorPage1.configureWebhookAction({
        url: 'https://httpbin.org/post/tab1',
      });
      await buttonEditorPage1.save();

      // Try to configure same button in second tab
      await deviceListPage2.clickDeviceCard(0);
      const deviceDetailPage2 = new DeviceDetailPage(page2);
      await deviceDetailPage2.clickButtonSlot(0);
      // Verify conflict detection
      await expect(
        page2.locator('[data-testid="conflict-warning"]')
      ).toBeVisible();
      await expect(
        page2.locator('[data-testid="conflict-warning"]')
      ).toContainText('This button has been modified in another session');

      await page1.close();
      await page2.close();
    });
  });
});
