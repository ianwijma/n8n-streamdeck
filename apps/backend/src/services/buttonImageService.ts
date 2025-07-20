import { createCanvas, loadImage } from 'canvas';
import { promises as fs } from 'fs';
import path from 'path';
import { Logger } from '@n8n-streamdeck/shared';
import { config } from '../config/environment';

const logger = new Logger({ level: config.logLevel }, 'ButtonImageService');

export interface ButtonImageOptions {
  title?: string;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  icon?: string;
  width?: number;
  height?: number;
}

export class ButtonImageService {
  private static instance: ButtonImageService;
  private imageCache = new Map<string, Buffer>();

  constructor() {
    logger.info('ButtonImageService initialized');
  }

  static getInstance(): ButtonImageService {
    if (!ButtonImageService.instance) {
      ButtonImageService.instance = new ButtonImageService();
    }
    return ButtonImageService.instance;
  }

  /**
   * Generate a button image based on configuration
   */
  async generateButtonImage(options: ButtonImageOptions): Promise<Buffer> {
    const {
      title = '',
      backgroundColor = '#000000',
      textColor = '#ffffff',
      fontSize = 12,
      icon,
      width = 72,
      height = 72,
    } = options;

    // Create cache key
    const cacheKey = JSON.stringify({
      title,
      backgroundColor,
      textColor,
      fontSize,
      icon,
      width,
      height,
    });

    // Check cache first
    if (this.imageCache.has(cacheKey)) {
      logger.debug('Returning cached button image', { title });
      return this.imageCache.get(cacheKey)!;
    }

    try {
      logger.debug('Generating button image', {
        title,
        backgroundColor,
        textColor,
        fontSize,
        width,
        height,
      });

      // Create canvas
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');

      // Fill background
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);

      // Draw icon if provided
      if (icon) {
        try {
          const iconPath = await this.resolveIconPath(icon);
          if (iconPath) {
            const iconImage = await loadImage(iconPath);
            const iconSize = Math.min(width, height) * 0.4;
            const iconX = (width - iconSize) / 2;
            const iconY = title
              ? (height - iconSize) / 3
              : (height - iconSize) / 2;

            ctx.drawImage(iconImage, iconX, iconY, iconSize, iconSize);
          }
        } catch (error) {
          logger.warn('Failed to load icon', {
            icon,
            error: (error as Error).message,
          });
        }
      }

      // Draw title if provided
      if (title) {
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Calculate font size to fit
        const maxWidth = width * 0.9;
        let actualFontSize = fontSize;

        do {
          ctx.font = `${actualFontSize}px Arial`;
          const metrics = ctx.measureText(title);
          if (metrics.width <= maxWidth) break;
          actualFontSize--;
        } while (actualFontSize > 8);

        ctx.font = `${actualFontSize}px Arial`;

        // Position text
        const textY = icon ? height * 0.8 : height / 2;

        // Handle multi-line text if needed
        const words = title.split(' ');
        if (words.length > 1 && ctx.measureText(title).width > maxWidth) {
          const lines = this.wrapText(ctx, title, maxWidth);
          const lineHeight = actualFontSize * 1.2;
          const startY = textY - ((lines.length - 1) * lineHeight) / 2;

          lines.forEach((line, index) => {
            ctx.fillText(line, width / 2, startY + index * lineHeight);
          });
        } else {
          ctx.fillText(title, width / 2, textY);
        }
      }

      // Convert to raw RGB buffer for StreamDeck
      const imageData = ctx.getImageData(0, 0, width, height);

      // Convert RGBA to RGB (StreamDeck expects RGB format)
      const rgbData = new Uint8Array(width * height * 3);
      for (let i = 0; i < imageData.data.length; i += 4) {
        const rgbIndex = (i / 4) * 3;
        rgbData[rgbIndex] = imageData.data[i]; // R
        rgbData[rgbIndex + 1] = imageData.data[i + 1]; // G
        rgbData[rgbIndex + 2] = imageData.data[i + 2]; // B
        // Skip alpha channel (imageData.data[i + 3])
      }

      const buffer = Buffer.from(rgbData);

      // Cache the result
      this.imageCache.set(cacheKey, buffer);

      // Limit cache size
      if (this.imageCache.size > 100) {
        const firstKey = this.imageCache.keys().next().value;
        if (firstKey) {
          this.imageCache.delete(firstKey);
        }
      }

      logger.debug('Button image generated successfully', {
        title,
        bufferSize: buffer.length,
      });

      return buffer;
    } catch (error) {
      logger.error('Failed to generate button image', error as Error, options);
      throw error;
    }
  }

  /**
   * Generate a blank/default button image
   */
  async generateBlankButton(width = 72, height = 72): Promise<Buffer> {
    return this.generateButtonImage({
      backgroundColor: '#000000',
      width,
      height,
    });
  }

  /**
   * Clear the image cache
   */
  clearCache(): void {
    this.imageCache.clear();
    logger.info('Button image cache cleared');
  }

  /**
   * Resolve icon path from various sources
   */
  private async resolveIconPath(icon: string): Promise<string | null> {
    // If it's already a full path and exists
    if (path.isAbsolute(icon)) {
      try {
        await fs.access(icon);
        return icon;
      } catch {
        return null;
      }
    }

    // Check in common icon directories
    const iconDirs = [
      path.join(process.cwd(), 'assets', 'icons'),
      path.join(process.cwd(), 'public', 'icons'),
      path.join(__dirname, '..', 'assets', 'icons'),
    ];

    for (const dir of iconDirs) {
      const iconPath = path.join(dir, icon);
      try {
        await fs.access(iconPath);
        return iconPath;
      } catch {
        // Try with common extensions
        for (const ext of ['.png', '.jpg', '.jpeg', '.svg']) {
          const iconPathWithExt = iconPath + ext;
          try {
            await fs.access(iconPathWithExt);
            return iconPathWithExt;
          } catch {
            continue;
          }
        }
      }
    }

    return null;
  }

  /**
   * Wrap text to fit within specified width
   */
  private wrapText(ctx: any, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = ctx.measureText(currentLine + ' ' + word).width;
      if (width < maxWidth) {
        currentLine += ' ' + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    return lines;
  }
}
