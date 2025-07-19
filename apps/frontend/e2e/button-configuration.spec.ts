import { test, expect } from '@playwright/test';

test.describe('Button Configuration E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Mock device API response
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

    // Navigate to device page
    await page.goto('/devices/device-1');
    await page.waitForLoadState('networkidle');
  });

  test('should display button grid for connected device', async ({ page }) => {
    // Check if the device name is displayed
    await expect(page.locator('h1')).toContainText('StreamDeck MK.2');

    // Check if the button grid is visible
    await expect(page.locator('[data-testid="button-grid"]')).toBeVisible();

    // Check if all 15 buttons are displayed (3x5 grid)
    await expect(page.locator('[data-testid="button-slot"]')).toHaveCount(15);
  });

  test('should open button editor when clicking on empty button', async ({
    page,
  }) => {
    // Click on the first button slot
    await page.locator('[data-testid="button-slot"]').first().click();

    // Check if the button editor modal opens
    await expect(
      page.locator('[data-testid="button-editor-modal"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="button-editor-title"]')
    ).toContainText('Configure Button');
  });

  test('should create webhook button configuration', async ({ page }) => {
    // Mock button creation API
    await page.route('**/api/devices/device-1/buttons/0', async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'button-1',
              deviceId: 'device-1',
              index: 0,
              label: 'Test Webhook',
              isEnabled: true,
              action: {
                type: 'webhook',
                url: 'https://httpbin.org/post',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                payload: { message: 'Hello from StreamDeck' },
              },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          }),
        });
      }
    });

    // Click on the first button slot
    await page.locator('[data-testid="button-slot"]').first().click();

    // Wait for the editor to open
    await expect(
      page.locator('[data-testid="button-editor-modal"]')
    ).toBeVisible();

    // Fill in button label
    await page
      .locator('[data-testid="button-label-input"]')
      .fill('Test Webhook');

    // Select webhook action type
    await page
      .locator('[data-testid="action-type-select"]')
      .selectOption('webhook');

    // Fill in webhook URL
    await page
      .locator('[data-testid="webhook-url-input"]')
      .fill('https://httpbin.org/post');

    // Select POST method
    await page
      .locator('[data-testid="webhook-method-select"]')
      .selectOption('POST');

    // Add headers
    await page.locator('[data-testid="add-header-button"]').click();
    await page.locator('[data-testid="header-key-input"]').fill('Content-Type');
    await page
      .locator('[data-testid="header-value-input"]')
      .fill('application/json');

    // Add payload
    await page
      .locator('[data-testid="webhook-payload-textarea"]')
      .fill('{"message": "Hello from StreamDeck"}');

    // Save the button configuration
    await page.locator('[data-testid="save-button"]').click();

    // Wait for the modal to close
    await expect(
      page.locator('[data-testid="button-editor-modal"]')
    ).not.toBeVisible();

    // Verify the button is now configured
    const firstButton = page.locator('[data-testid="button-slot"]').first();
    await expect(
      firstButton.locator('[data-testid="button-label"]')
    ).toContainText('Test Webhook');
    await expect(
      firstButton.locator('[data-testid="button-type"]')
    ).toContainText('webhook');
  });

  test('should create workflow trigger button configuration', async ({
    page,
  }) => {
    // Mock button creation API
    await page.route('**/api/devices/device-1/buttons/1', async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'button-2',
              deviceId: 'device-1',
              index: 1,
              label: 'Trigger Workflow',
              isEnabled: true,
              action: {
                type: 'workflow-trigger',
                workflowId: 'workflow-123',
                payload: { source: 'streamdeck' },
              },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          }),
        });
      }
    });

    // Click on the second button slot
    await page.locator('[data-testid="button-slot"]').nth(1).click();

    // Wait for the editor to open
    await expect(
      page.locator('[data-testid="button-editor-modal"]')
    ).toBeVisible();

    // Fill in button label
    await page
      .locator('[data-testid="button-label-input"]')
      .fill('Trigger Workflow');

    // Select workflow trigger action type
    await page
      .locator('[data-testid="action-type-select"]')
      .selectOption('workflow-trigger');

    // Fill in workflow ID
    await page
      .locator('[data-testid="workflow-id-input"]')
      .fill('workflow-123');

    // Add payload
    await page
      .locator('[data-testid="workflow-payload-textarea"]')
      .fill('{"source": "streamdeck"}');

    // Save the button configuration
    await page.locator('[data-testid="save-button"]').click();

    // Wait for the modal to close
    await expect(
      page.locator('[data-testid="button-editor-modal"]')
    ).not.toBeVisible();

    // Verify the button is now configured
    const secondButton = page.locator('[data-testid="button-slot"]').nth(1);
    await expect(
      secondButton.locator('[data-testid="button-label"]')
    ).toContainText('Trigger Workflow');
    await expect(
      secondButton.locator('[data-testid="button-type"]')
    ).toContainText('workflow');
  });

  test('should create hotkey button configuration', async ({ page }) => {
    // Mock button creation API
    await page.route('**/api/devices/device-1/buttons/2', async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'button-3',
              deviceId: 'device-1',
              index: 2,
              label: 'Copy Shortcut',
              isEnabled: true,
              action: {
                type: 'hotkey',
                keys: ['ctrl', 'c'],
                modifiers: ['ctrl'],
              },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          }),
        });
      }
    });

    // Click on the third button slot
    await page.locator('[data-testid="button-slot"]').nth(2).click();

    // Wait for the editor to open
    await expect(
      page.locator('[data-testid="button-editor-modal"]')
    ).toBeVisible();

    // Fill in button label
    await page
      .locator('[data-testid="button-label-input"]')
      .fill('Copy Shortcut');

    // Select hotkey action type
    await page
      .locator('[data-testid="action-type-select"]')
      .selectOption('hotkey');

    // Add hotkey combination
    await page.locator('[data-testid="hotkey-input"]').click();
    await page.keyboard.press('Control+c');

    // Verify the hotkey is captured
    await expect(page.locator('[data-testid="hotkey-display"]')).toContainText(
      'Ctrl+C'
    );

    // Save the button configuration
    await page.locator('[data-testid="save-button"]').click();

    // Wait for the modal to close
    await expect(
      page.locator('[data-testid="button-editor-modal"]')
    ).not.toBeVisible();

    // Verify the button is now configured
    const thirdButton = page.locator('[data-testid="button-slot"]').nth(2);
    await expect(
      thirdButton.locator('[data-testid="button-label"]')
    ).toContainText('Copy Shortcut');
    await expect(
      thirdButton.locator('[data-testid="button-type"]')
    ).toContainText('hotkey');
  });

  test('should edit existing button configuration', async ({ page }) => {
    // Mock existing button data
    await page.route('**/api/devices/device-1/buttons', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'button-1',
              deviceId: 'device-1',
              index: 0,
              label: 'Existing Button',
              isEnabled: true,
              action: {
                type: 'webhook',
                url: 'https://example.com/webhook',
                method: 'POST',
              },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    // Mock button update API
    await page.route('**/api/devices/device-1/buttons/0', async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'button-1',
              deviceId: 'device-1',
              index: 0,
              label: 'Updated Button',
              isEnabled: true,
              action: {
                type: 'webhook',
                url: 'https://updated.com/webhook',
                method: 'POST',
              },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          }),
        });
      }
    });

    // Reload the page to get the existing button
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Click on the configured button to edit it
    await page.locator('[data-testid="button-slot"]').first().click();

    // Wait for the editor to open
    await expect(
      page.locator('[data-testid="button-editor-modal"]')
    ).toBeVisible();

    // Verify existing values are loaded
    await expect(
      page.locator('[data-testid="button-label-input"]')
    ).toHaveValue('Existing Button');
    await expect(page.locator('[data-testid="webhook-url-input"]')).toHaveValue(
      'https://example.com/webhook'
    );

    // Update the label
    await page
      .locator('[data-testid="button-label-input"]')
      .fill('Updated Button');

    // Update the URL
    await page
      .locator('[data-testid="webhook-url-input"]')
      .fill('https://updated.com/webhook');

    // Save the changes
    await page.locator('[data-testid="save-button"]').click();

    // Wait for the modal to close
    await expect(
      page.locator('[data-testid="button-editor-modal"]')
    ).not.toBeVisible();

    // Verify the button label is updated
    const firstButton = page.locator('[data-testid="button-slot"]').first();
    await expect(
      firstButton.locator('[data-testid="button-label"]')
    ).toContainText('Updated Button');
  });

  test('should delete button configuration', async ({ page }) => {
    // Mock existing button data
    await page.route('**/api/devices/device-1/buttons', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'button-1',
              deviceId: 'device-1',
              index: 0,
              label: 'Button to Delete',
              isEnabled: true,
              action: {
                type: 'webhook',
                url: 'https://example.com/webhook',
                method: 'POST',
              },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    // Mock button deletion API
    await page.route('**/api/devices/device-1/buttons/0', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'button-1',
              deviceId: 'device-1',
              index: 0,
              label: '',
              isEnabled: true,
              action: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          }),
        });
      }
    });

    // Reload the page to get the existing button
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Right-click on the configured button to open context menu
    await page
      .locator('[data-testid="button-slot"]')
      .first()
      .click({ button: 'right' });

    // Click delete option
    await page.locator('[data-testid="delete-button-option"]').click();

    // Confirm deletion in the confirmation dialog
    await page.locator('[data-testid="confirm-delete-button"]').click();

    // Verify the button is now empty
    const firstButton = page.locator('[data-testid="button-slot"]').first();
    await expect(
      firstButton.locator('[data-testid="button-label"]')
    ).not.toBeVisible();
    await expect(
      firstButton.locator('[data-testid="empty-button-placeholder"]')
    ).toBeVisible();
  });

  test('should simulate button press', async ({ page }) => {
    // Mock existing button data
    await page.route('**/api/devices/device-1/buttons', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'button-1',
              deviceId: 'device-1',
              index: 0,
              label: 'Test Button',
              isEnabled: true,
              action: {
                type: 'webhook',
                url: 'https://httpbin.org/post',
                method: 'POST',
              },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    // Mock button press API
    await page.route(
      '**/api/devices/device-1/buttons/0/press',
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              executed: true,
              timestamp: new Date().toISOString(),
            },
          }),
        });
      }
    );

    // Reload the page to get the existing button
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Double-click on the button to simulate press
    await page.locator('[data-testid="button-slot"]').first().dblclick();

    // Verify press feedback is shown
    await expect(
      page.locator('[data-testid="button-press-feedback"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="button-press-feedback"]')
    ).toContainText('Button pressed successfully');
  });

  test('should validate button configuration', async ({ page }) => {
    // Click on the first button slot
    await page.locator('[data-testid="button-slot"]').first().click();

    // Wait for the editor to open
    await expect(
      page.locator('[data-testid="button-editor-modal"]')
    ).toBeVisible();

    // Try to save without filling required fields
    await page.locator('[data-testid="save-button"]').click();

    // Verify validation errors are shown
    await expect(
      page.locator('[data-testid="validation-error"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="validation-error"]')
    ).toContainText('Label is required');

    // Fill in label but leave action type empty
    await page
      .locator('[data-testid="button-label-input"]')
      .fill('Test Button');
    await page.locator('[data-testid="save-button"]').click();

    // Verify action type validation error
    await expect(
      page.locator('[data-testid="validation-error"]')
    ).toContainText('Action type is required');

    // Select webhook but leave URL empty
    await page
      .locator('[data-testid="action-type-select"]')
      .selectOption('webhook');
    await page.locator('[data-testid="save-button"]').click();

    // Verify URL validation error
    await expect(
      page.locator('[data-testid="validation-error"]')
    ).toContainText('URL is required');

    // Enter invalid URL
    await page
      .locator('[data-testid="webhook-url-input"]')
      .fill('not-a-valid-url');
    await page.locator('[data-testid="save-button"]').click();

    // Verify URL format validation error
    await expect(
      page.locator('[data-testid="validation-error"]')
    ).toContainText('Invalid URL format');
  });

  test('should handle button configuration errors', async ({ page }) => {
    // Mock button creation error
    await page.route('**/api/devices/device-1/buttons/0', async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Failed to save button configuration',
          }),
        });
      }
    });

    // Click on the first button slot
    await page.locator('[data-testid="button-slot"]').first().click();

    // Fill in valid configuration
    await page
      .locator('[data-testid="button-label-input"]')
      .fill('Test Button');
    await page
      .locator('[data-testid="action-type-select"]')
      .selectOption('webhook');
    await page
      .locator('[data-testid="webhook-url-input"]')
      .fill('https://httpbin.org/post');

    // Try to save
    await page.locator('[data-testid="save-button"]').click();

    // Verify error message is shown
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText(
      'Failed to save button configuration'
    );

    // Verify the modal is still open
    await expect(
      page.locator('[data-testid="button-editor-modal"]')
    ).toBeVisible();
  });
});
