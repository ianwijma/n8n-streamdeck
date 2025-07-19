import { Page, expect } from '@playwright/test';

export abstract class BasePage {
  protected page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(path: string = '') {
    await this.page.goto(path);
    await this.waitForPageLoad();
  }

  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  async waitForElement(selector: string, options?: { timeout?: number }) {
    return await this.page.waitForSelector(selector, options);
  }

  async clickElement(selector: string) {
    await this.page.click(selector);
  }

  async fillInput(selector: string, value: string) {
    await this.page.fill(selector, value);
  }

  async selectOption(selector: string, value: string) {
    await this.page.selectOption(selector, value);
  }

  async getText(selector: string): Promise<string> {
    return (await this.page.textContent(selector)) || '';
  }

  async isVisible(selector: string): Promise<boolean> {
    return await this.page.isVisible(selector);
  }

  async waitForToast(message?: string) {
    const toast = this.page.locator('[data-testid="toast"]');
    await expect(toast).toBeVisible();
    if (message) {
      await expect(toast).toContainText(message);
    }
    return toast;
  }

  async waitForErrorMessage(message?: string) {
    const error = this.page.locator('[data-testid="error-message"]');
    await expect(error).toBeVisible();
    if (message) {
      await expect(error).toContainText(message);
    }
    return error;
  }

  async waitForLoadingToFinish() {
    await this.page.waitForSelector('[data-testid="loading"]', {
      state: 'hidden',
    });
  }

  async takeScreenshot(name: string) {
    await this.page.screenshot({
      path: `test-results/screenshots/${name}.png`,
    });
  }
}
