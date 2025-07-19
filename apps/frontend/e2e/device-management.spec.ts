import { test, expect } from '@playwright/test';

test.describe('Device Management E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the main page
    await page.goto('/');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should display device list page', async ({ page }) => {
    // Check if the main heading is visible
    await expect(page.locator('h1')).toContainText('StreamDeck Devices');

    // Check if the device list container is present
    await expect(page.locator('[data-testid="device-list"]')).toBeVisible();
  });

  test('should show empty state when no devices are connected', async ({
    page,
  }) => {
    // Check for empty state message
    await expect(page.locator('[data-testid="empty-state"]')).toBeVisible();
    await expect(page.locator('[data-testid="empty-state"]')).toContainText(
      'No devices found'
    );
  });

  test('should display connected devices', async ({ page }) => {
    // Mock API response for connected devices
    await page.route('**/api/devices', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'device-1',
              name: 'StreamDeck MK.2',
              type: 'streamdeck-mk2',
              serialNumber: 'CL12345678',
              buttonCount: 15,
              isConnected: true,
              firmwareVersion: '1.0.0',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            {
              id: 'device-2',
              name: 'StreamDeck Mini',
              type: 'streamdeck-mini',
              serialNumber: 'CL87654321',
              buttonCount: 6,
              isConnected: false,
              firmwareVersion: '1.0.0',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    // Reload the page to trigger the API call
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Check if devices are displayed
    await expect(page.locator('[data-testid="device-card"]')).toHaveCount(2);

    // Check first device details
    const firstDevice = page.locator('[data-testid="device-card"]').first();
    await expect(
      firstDevice.locator('[data-testid="device-name"]')
    ).toContainText('StreamDeck MK.2');
    await expect(
      firstDevice.locator('[data-testid="device-status"]')
    ).toContainText('Connected');

    // Check second device details
    const secondDevice = page.locator('[data-testid="device-card"]').nth(1);
    await expect(
      secondDevice.locator('[data-testid="device-name"]')
    ).toContainText('StreamDeck Mini');
    await expect(
      secondDevice.locator('[data-testid="device-status"]')
    ).toContainText('Disconnected');
  });

  test('should connect to a disconnected device', async ({ page }) => {
    // Mock initial devices API response
    await page.route('**/api/devices', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'device-1',
              name: 'StreamDeck MK.2',
              type: 'streamdeck-mk2',
              serialNumber: 'CL12345678',
              buttonCount: 15,
              isConnected: false,
              firmwareVersion: '1.0.0',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    // Mock device connection API response
    await page.route('**/api/devices/device-1/connect', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'device-1',
            name: 'StreamDeck MK.2',
            type: 'streamdeck-mk2',
            serialNumber: 'CL12345678',
            buttonCount: 15,
            isConnected: true,
            firmwareVersion: '1.0.0',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      });
    });

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Click connect button
    const deviceCard = page.locator('[data-testid="device-card"]').first();
    await deviceCard.locator('[data-testid="connect-button"]').click();

    // Wait for the connection to complete
    await page.waitForTimeout(1000);

    // Verify the device status changed to connected
    await expect(
      deviceCard.locator('[data-testid="device-status"]')
    ).toContainText('Connected');
  });

  test('should navigate to device details page', async ({ page }) => {
    // Mock devices API response
    await page.route('**/api/devices', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'device-1',
              name: 'StreamDeck MK.2',
              type: 'streamdeck-mk2',
              serialNumber: 'CL12345678',
              buttonCount: 15,
              isConnected: true,
              firmwareVersion: '1.0.0',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    // Mock device details API response
    await page.route('**/api/devices/device-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'device-1',
            name: 'StreamDeck MK.2',
            type: 'streamdeck-mk2',
            serialNumber: 'CL12345678',
            buttonCount: 15,
            isConnected: true,
            firmwareVersion: '1.0.0',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      });
    });

    // Mock buttons API response
    await page.route('**/api/devices/device-1/buttons', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [],
        }),
      });
    });

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Click on device card to navigate to details
    const deviceCard = page.locator('[data-testid="device-card"]').first();
    await deviceCard.locator('[data-testid="device-name"]').click();

    // Wait for navigation
    await page.waitForURL('**/devices/device-1');

    // Verify we're on the device details page
    await expect(page.locator('h1')).toContainText('StreamDeck MK.2');
    await expect(page.locator('[data-testid="button-grid"]')).toBeVisible();
  });

  test('should handle device connection errors', async ({ page }) => {
    // Mock devices API response
    await page.route('**/api/devices', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'device-1',
              name: 'StreamDeck MK.2',
              type: 'streamdeck-mk2',
              serialNumber: 'CL12345678',
              buttonCount: 15,
              isConnected: false,
              firmwareVersion: '1.0.0',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    // Mock device connection error response
    await page.route('**/api/devices/device-1/connect', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Failed to connect to device',
        }),
      });
    });

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Click connect button
    const deviceCard = page.locator('[data-testid="device-card"]').first();
    await deviceCard.locator('[data-testid="connect-button"]').click();

    // Wait for error message to appear
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText(
      'Failed to connect'
    );
  });

  test('should refresh device list', async ({ page }) => {
    let callCount = 0;

    // Mock devices API response with counter
    await page.route('**/api/devices', async (route) => {
      callCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'device-1',
              name: `StreamDeck MK.2 (Call ${callCount})`,
              type: 'streamdeck-mk2',
              serialNumber: 'CL12345678',
              buttonCount: 15,
              isConnected: true,
              firmwareVersion: '1.0.0',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify initial load
    await expect(page.locator('[data-testid="device-name"]')).toContainText(
      'Call 1'
    );

    // Click refresh button
    await page.locator('[data-testid="refresh-button"]').click();
    await page.waitForTimeout(1000);

    // Verify the list was refreshed
    await expect(page.locator('[data-testid="device-name"]')).toContainText(
      'Call 2'
    );
  });

  test('should filter devices by connection status', async ({ page }) => {
    // Mock devices API response
    await page.route('**/api/devices', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'device-1',
              name: 'Connected Device',
              type: 'streamdeck-mk2',
              serialNumber: 'CL12345678',
              buttonCount: 15,
              isConnected: true,
              firmwareVersion: '1.0.0',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            {
              id: 'device-2',
              name: 'Disconnected Device',
              type: 'streamdeck-mini',
              serialNumber: 'CL87654321',
              buttonCount: 6,
              isConnected: false,
              firmwareVersion: '1.0.0',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify all devices are shown initially
    await expect(page.locator('[data-testid="device-card"]')).toHaveCount(2);

    // Filter by connected devices only
    await page.locator('[data-testid="filter-connected"]').click();
    await expect(page.locator('[data-testid="device-card"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="device-name"]')).toContainText(
      'Connected Device'
    );

    // Filter by disconnected devices only
    await page.locator('[data-testid="filter-disconnected"]').click();
    await expect(page.locator('[data-testid="device-card"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="device-name"]')).toContainText(
      'Disconnected Device'
    );

    // Show all devices
    await page.locator('[data-testid="filter-all"]').click();
    await expect(page.locator('[data-testid="device-card"]')).toHaveCount(2);
  });
});
