import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class DeviceDetailPage extends BasePage {
  private readonly buttonGrid: Locator;
  private readonly deviceName: Locator;
  private readonly backButton: Locator;

  constructor(page: Page) {
    super(page);
    this.buttonGrid = page.locator('[data-testid="button-grid"]');
    this.deviceName = page.locator('h1');
    this.backButton = page.locator('[data-testid="back-button"]');
  }

  async goto(deviceId: string) {
    await super.goto(`/devices/${deviceId}`);
  }

  async getButtonSlots() {
    return this.page.locator('[data-testid="button-slot"]');
  }

  async getButtonSlot(index: number) {
    const slots = await this.getButtonSlots();
    return slots.nth(index);
  }

  async clickButtonSlot(index: number) {
    const slot = await this.getButtonSlot(index);
    await slot.click();
  }

  async rightClickButtonSlot(index: number) {
    const slot = await this.getButtonSlot(index);
    await slot.click({ button: 'right' });
  }

  async doubleClickButtonSlot(index: number) {
    const slot = await this.getButtonSlot(index);
    await slot.dblclick();
  }

  async expectDeviceName(name: string) {
    await expect(this.deviceName).toContainText(name);
  }

  async expectButtonGridVisible() {
    await expect(this.buttonGrid).toBeVisible();
  }

  async expectButtonCount(count: number) {
    const slots = await this.getButtonSlots();
    await expect(slots).toHaveCount(count);
  }

  async expectButtonLabel(index: number, label: string) {
    const slot = await this.getButtonSlot(index);
    await expect(slot.locator('[data-testid="button-label"]')).toContainText(
      label
    );
  }

  async expectButtonType(index: number, type: string) {
    const slot = await this.getButtonSlot(index);
    await expect(slot.locator('[data-testid="button-type"]')).toContainText(
      type
    );
  }

  async expectEmptyButtonSlot(index: number) {
    const slot = await this.getButtonSlot(index);
    await expect(
      slot.locator('[data-testid="empty-button-placeholder"]')
    ).toBeVisible();
  }

  async expectButtonPressFeedback() {
    await expect(
      this.page.locator('[data-testid="button-press-feedback"]')
    ).toBeVisible();
  }

  async goBack() {
    await this.backButton.click();
  }
}
