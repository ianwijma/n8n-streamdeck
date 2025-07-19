import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth/user.json');

setup('authenticate', async ({ page }) => {
  // For now, we don't have authentication, but we can prepare the environment
  // This setup can be extended when authentication is added

  // Navigate to the app
  await page.goto('/');

  // Wait for the app to load
  await page.waitForLoadState('networkidle');

  // Verify the app is accessible
  await expect(page.locator('h1').first()).toBeVisible();

  // Save signed-in state to 'authFile'
  await page.context().storageState({ path: authFile });
});

setup('prepare test environment', async ({ page }) => {
  // Set up any global test data or configuration

  // Mock localStorage settings if needed
  await page.addInitScript(() => {
    localStorage.setItem(
      'streamdeck-settings',
      JSON.stringify({
        theme: 'light',
        autoConnect: true,
        notifications: true,
      })
    );
  });

  // Set up test database state if needed
  // This could include API calls to reset test data

  console.log('Test environment prepared');
});
