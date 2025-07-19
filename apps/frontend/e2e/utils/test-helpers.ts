import { Page, expect, Locator } from '@playwright/test';

export class TestHelpers {
  static async waitForStableElement(locator: Locator, timeout = 5000) {
    // Wait for element to be visible and stable (not moving/changing)
    await expect(locator).toBeVisible({ timeout });

    // Wait for any animations to complete
    await locator.page().waitForTimeout(100);

    // Ensure element is still visible after animation
    await expect(locator).toBeVisible();
  }

  static async waitForNetworkIdle(page: Page, timeout = 5000) {
    // Wait for network to be idle (no requests for 500ms)
    await page.waitForLoadState('networkidle', { timeout });
  }

  static async retryAction(
    action: () => Promise<void>,
    maxRetries = 3,
    delay = 1000
  ) {
    let lastError: Error | null = null;

    for (let i = 0; i < maxRetries; i++) {
      try {
        await action();
        return; // Success, exit retry loop
      } catch (error) {
        lastError = error as Error;
        if (i < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  static async waitForElementToBeStable(
    locator: Locator,
    stableFor = 500,
    timeout = 5000
  ) {
    const startTime = Date.now();
    let lastBoundingBox: any = null;
    let stableStartTime: number | null = null;

    while (Date.now() - startTime < timeout) {
      try {
        const currentBoundingBox = await locator.boundingBox();

        if (currentBoundingBox) {
          if (
            lastBoundingBox &&
            currentBoundingBox.x === lastBoundingBox.x &&
            currentBoundingBox.y === lastBoundingBox.y &&
            currentBoundingBox.width === lastBoundingBox.width &&
            currentBoundingBox.height === lastBoundingBox.height
          ) {
            if (stableStartTime === null) {
              stableStartTime = Date.now();
            } else if (Date.now() - stableStartTime >= stableFor) {
              return; // Element has been stable for the required duration
            }
          } else {
            stableStartTime = null; // Reset stability timer
          }

          lastBoundingBox = currentBoundingBox;
        }
      } catch (error) {
        // Element might not be visible yet, continue waiting
      }

      await locator.page().waitForTimeout(50);
    }

    throw new Error(`Element did not become stable within ${timeout}ms`);
  }

  static async clickWithRetry(locator: Locator, maxRetries = 3) {
    await this.retryAction(async () => {
      await this.waitForStableElement(locator);
      await locator.click();
    }, maxRetries);
  }

  static async fillWithRetry(locator: Locator, value: string, maxRetries = 3) {
    await this.retryAction(async () => {
      await this.waitForStableElement(locator);
      await locator.fill(value);

      // Verify the value was actually filled
      const actualValue = await locator.inputValue();
      if (actualValue !== value) {
        throw new Error(`Expected value "${value}" but got "${actualValue}"`);
      }
    }, maxRetries);
  }

  static async selectWithRetry(
    locator: Locator,
    value: string,
    maxRetries = 3
  ) {
    await this.retryAction(async () => {
      await this.waitForStableElement(locator);
      await locator.selectOption(value);

      // Verify the option was actually selected
      const selectedValue = await locator.inputValue();
      if (selectedValue !== value) {
        throw new Error(
          `Expected selected value "${value}" but got "${selectedValue}"`
        );
      }
    }, maxRetries);
  }

  static async waitForApiResponse(
    page: Page,
    urlPattern: string | RegExp,
    timeout = 10000
  ) {
    return await page.waitForResponse(
      (response) => {
        const url = response.url();
        if (typeof urlPattern === 'string') {
          return url.includes(urlPattern);
        }
        return urlPattern.test(url);
      },
      { timeout }
    );
  }

  static async mockApiError(
    page: Page,
    urlPattern: string,
    errorMessage = 'API Error',
    statusCode = 500
  ) {
    await page.route(`**/${urlPattern}`, async (route) => {
      await route.fulfill({
        status: statusCode,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: errorMessage,
        }),
      });
    });
  }

  static async mockApiSuccess(page: Page, urlPattern: string, data: any) {
    await page.route(`**/${urlPattern}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data,
        }),
      });
    });
  }

  static async waitForToastMessage(
    page: Page,
    expectedMessage?: string,
    timeout = 5000
  ) {
    const toast = page.locator('[data-testid="toast"]');
    await expect(toast).toBeVisible({ timeout });

    if (expectedMessage) {
      await expect(toast).toContainText(expectedMessage);
    }

    return toast;
  }

  static async dismissToast(page: Page) {
    const toast = page.locator('[data-testid="toast"]');
    const closeButton = toast.locator('[data-testid="toast-close"]');

    if (await closeButton.isVisible()) {
      await closeButton.click();
    }

    await expect(toast).not.toBeVisible();
  }

  static async takeScreenshotOnFailure(page: Page, testName: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${testName}-${timestamp}.png`;
    await page.screenshot({
      path: `test-results/screenshots/${filename}`,
      fullPage: true,
    });
    return filename;
  }

  static async logConsoleErrors(page: Page) {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    return errors;
  }

  static async clearBrowserData(page: Page) {
    // Clear localStorage
    await page.evaluate(() => {
      localStorage.clear();
    });

    // Clear sessionStorage
    await page.evaluate(() => {
      sessionStorage.clear();
    });

    // Clear cookies
    await page.context().clearCookies();
  }

  static async simulateSlowNetwork(page: Page) {
    // Simulate slow 3G network
    await page.route('**/*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 100)); // Add 100ms delay
      await route.continue();
    });
  }

  static async simulateOfflineMode(page: Page, offline = true) {
    await page.context().setOffline(offline);
  }

  static generateTestId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  static async waitForElementCount(
    locator: Locator,
    expectedCount: number,
    timeout = 5000
  ) {
    await expect(locator).toHaveCount(expectedCount, { timeout });
  }

  static async scrollIntoView(locator: Locator) {
    await locator.scrollIntoViewIfNeeded();
    await locator.page().waitForTimeout(100); // Wait for scroll to complete
  }

  static async dragAndDrop(
    source: Locator,
    target: Locator,
    options?: { force?: boolean }
  ) {
    await this.waitForStableElement(source);
    await this.waitForStableElement(target);

    await source.dragTo(target, options);

    // Wait for any drag-and-drop animations to complete
    await source.page().waitForTimeout(300);
  }
}
