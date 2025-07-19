import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class DeviceListPage extends BasePage {
  private readonly emptyState: Locator;
  private readonly refreshButton: Locator;
  private readonly filterButtons: {
    all: Locator;
    connected: Locator;
    disconnected: Locator;
  };

  constructor(page: Page) {
    super(page);
    this.emptyState = page.locator('[data-testid="empty-state"]');
    this.refreshButton = page.locator('[data-testid="refresh-button"]');
    this.filterButtons = {
      all: page.locator('[data-testid="filter-all"]'),
      connected: page.locator('[data-testid="filter-connected"]'),
      disconnected: page.locator('[data-testid="filter-disconnected"]'),
    };
  }

  async goto() {
    await super.goto('/');
  }

  async getDeviceCards() {
    return this.page.locator('[data-testid="device-card"]');
  }

  async getDeviceCard(index: number) {
    const cards = await this.getDeviceCards();
    return cards.nth(index);
  }

  async getDeviceCardByName(name: string) {
    return this.page.locator(`[data-testid="device-card"]:has-text("${name}")`);
  }

  async clickDeviceCard(index: number) {
    const card = await this.getDeviceCard(index);
    await card.locator('[data-testid="device-name"]').click();
  }

  async clickDeviceCardByName(name: string) {
    const card = await this.getDeviceCardByName(name);
    await card.locator('[data-testid="device-name"]').click();
  }

  async connectDevice(index: number) {
    const card = await this.getDeviceCard(index);
    await card.locator('[data-testid="connect-button"]').click();
  }

  async disconnectDevice(index: number) {
    const card = await this.getDeviceCard(index);
    await card.locator('[data-testid="disconnect-button"]').click();
  }

  async refreshDeviceList() {
    await this.refreshButton.click();
    await this.waitForLoadingToFinish();
  }

  async filterDevices(filter: 'all' | 'connected' | 'disconnected') {
    await this.filterButtons[filter].click();
  }

  async expectDeviceCount(count: number) {
    const cards = await this.getDeviceCards();
    await expect(cards).toHaveCount(count);
  }

  async expectEmptyState() {
    await expect(this.emptyState).toBeVisible();
    await expect(this.emptyState).toContainText('No devices found');
  }

  async expectDeviceStatus(
    index: number,
    status: 'Connected' | 'Disconnected'
  ) {
    const card = await this.getDeviceCard(index);
    await expect(card.locator('[data-testid="device-status"]')).toContainText(
      status
    );
  }

  async expectDeviceName(index: number, name: string) {
    const card = await this.getDeviceCard(index);
    await expect(card.locator('[data-testid="device-name"]')).toContainText(
      name
    );
  }

  async waitForDeviceUpdate(deviceName: string, expectedStatus: string) {
    const card = await this.getDeviceCardByName(deviceName);
    await expect(card.locator('[data-testid="device-status"]')).toContainText(
      expectedStatus
    );
  }
}
