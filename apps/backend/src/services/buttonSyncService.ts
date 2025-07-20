import { Logger, Button } from '@n8n-streamdeck/shared';
import { config } from '../config/environment';
import { ButtonImageService } from './buttonImageService';
import { StreamDeckService } from './streamDeckService';

const logger = new Logger({ level: config.logLevel }, 'ButtonSyncService');

export class ButtonSyncService {
  private static instance: ButtonSyncService;
  private imageService: ButtonImageService;
  private streamDeckService: StreamDeckService;

  constructor() {
    this.imageService = ButtonImageService.getInstance();
    this.streamDeckService = StreamDeckService.getInstance();
    logger.info('ButtonSyncService initialized');
  }

  static getInstance(): ButtonSyncService {
    if (!ButtonSyncService.instance) {
      ButtonSyncService.instance = new ButtonSyncService();
    }
    return ButtonSyncService.instance;
  }

  /**
   * Initialize all buttons on a device with current configurations
   */
  async initializeDeviceButtons(
    deviceId: string,
    buttons: Button[]
  ): Promise<void> {
    try {
      if (!this.streamDeckService.isDeviceConnected(deviceId)) {
        logger.warn('Device not connected, skipping initialization', {
          deviceId,
        });
        return;
      }

      logger.info('Initializing device buttons', {
        deviceId,
        buttonCount: buttons.length,
      });

      // Update all buttons in parallel
      const updatePromises = buttons.map(async (button) => {
        try {
          await this.updatePhysicalButton(deviceId, button);
        } catch (error) {
          logger.error('Failed to initialize button', error as Error, {
            deviceId,
            buttonIndex: button.index,
            title: button.label,
          });
        }
      });

      await Promise.all(updatePromises);

      logger.info('Device button initialization completed', {
        deviceId,
        buttonCount: buttons.length,
      });
    } catch (error) {
      logger.error('Failed to initialize device buttons', error as Error, {
        deviceId,
      });
    }
  }

  /**
   * Reset all buttons on a device to neutral state
   */
  async resetDeviceButtons(deviceId: string): Promise<void> {
    try {
      if (!this.streamDeckService.isDeviceConnected(deviceId)) {
        logger.warn('Device not connected, skipping reset', { deviceId });
        return;
      }

      const device = this.streamDeckService.getDevice(deviceId);
      if (!device) {
        logger.warn('Device not found, skipping reset', { deviceId });
        return;
      }

      logger.info('Resetting device buttons to neutral state', {
        deviceId,
        buttonCount: device.buttonCount,
      });

      // Clear all buttons in parallel
      const clearPromises = Array.from(
        { length: device.buttonCount },
        (_, index) =>
          this.streamDeckService.clearButton(deviceId, index).catch((error) => {
            logger.error('Failed to clear button', error as Error, {
              deviceId,
              buttonIndex: index,
            });
          })
      );

      await Promise.all(clearPromises);

      logger.info('Device button reset completed', {
        deviceId,
        buttonCount: device.buttonCount,
      });
    } catch (error) {
      logger.error('Failed to reset device buttons', error as Error, {
        deviceId,
      });
    }
  }

  /**
   * Update a single physical button
   */
  async updatePhysicalButton(deviceId: string, button: Button): Promise<void> {
    try {
      // Check if device is connected
      if (!this.streamDeckService.isDeviceConnected(deviceId)) {
        logger.warn('Device not connected, skipping physical update', {
          deviceId,
          buttonIndex: button.index,
        });
        return;
      }

      // Get device info to determine button dimensions
      const device = this.streamDeckService.getDevice(deviceId);
      if (!device) {
        throw new Error(`Device ${deviceId} not found`);
      }

      // Get button dimensions based on device type
      const buttonDimensions = this.getButtonDimensions(device.type);

      logger.debug('Updating physical button', {
        deviceId,
        buttonIndex: button.index,
        title: button.label,
        backgroundColor: button.backgroundColor,
        dimensions: buttonDimensions,
      });

      // Generate button image from configuration
      const imageBuffer = await this.imageService.generateButtonImage({
        title: button.label,
        backgroundColor: button.backgroundColor || '#000000',
        textColor: button.textColor || '#ffffff',
        fontSize: button.fontSize || 12,
        icon: button.icon,
        width: buttonDimensions.width,
        height: buttonDimensions.height,
      });

      // Update the physical device
      await this.streamDeckService.setButtonImageFromBuffer(
        deviceId,
        button.index,
        imageBuffer
      );

      logger.debug('Physical button updated successfully', {
        deviceId,
        buttonIndex: button.index,
        title: button.label,
      });
    } catch (error) {
      logger.error('Failed to update physical button', error as Error, {
        deviceId,
        buttonIndex: button.index,
        title: button.label,
      });
      throw error;
    }
  }

  /**
   * Get button dimensions for device type
   */
  private getButtonDimensions(deviceType: string): {
    width: number;
    height: number;
  } {
    switch (deviceType) {
      case 'streamdeck-mini':
        return { width: 80, height: 80 };
      case 'streamdeck-xl':
        return { width: 96, height: 96 };
      case 'streamdeck-plus':
        return { width: 120, height: 120 };
      case 'streamdeck-mk2':
        return { width: 72, height: 72 };
      case 'streamdeck-original':
      default:
        return { width: 72, height: 72 };
    }
  }
}
