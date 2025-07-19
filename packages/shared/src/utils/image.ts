export interface ImageProcessingOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'png' | 'jpg' | 'jpeg' | 'webp';
  backgroundColor?: string;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

export interface ImageInfo {
  width: number;
  height: number;
  format: string;
  size: number;
  hasAlpha: boolean;
}

export interface ProcessedImage {
  data: Buffer;
  info: ImageInfo;
}

// StreamDeck button dimensions for different device types
export const STREAMDECK_BUTTON_SIZES = {
  'streamdeck-original': { width: 72, height: 72 },
  'streamdeck-mini': { width: 80, height: 80 },
  'streamdeck-xl': { width: 96, height: 96 },
  'streamdeck-mk2': { width: 72, height: 72 },
  'streamdeck-plus': { width: 120, height: 120 },
} as const;

export type StreamDeckDeviceType = keyof typeof STREAMDECK_BUTTON_SIZES;

// Image validation
export const validateImage = (buffer: Buffer, maxSize: number = 5 * 1024 * 1024): { valid: boolean; error?: string } => {
  if (buffer.length === 0) {
    return { valid: false, error: 'Image buffer is empty' };
  }

  if (buffer.length > maxSize) {
    return { valid: false, error: `Image size (${buffer.length} bytes) exceeds maximum allowed size (${maxSize} bytes)` };
  }

  // Check for common image format signatures
  const signatures = {
    png: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
    jpg: [0xFF, 0xD8, 0xFF],
    gif: [0x47, 0x49, 0x46],
    webp: [0x52, 0x49, 0x46, 0x46],
    bmp: [0x42, 0x4D],
  };

  const isValidFormat = Object.values(signatures).some(signature => 
    signature.every((byte, index) => buffer[index] === byte)
  );

  if (!isValidFormat) {
    return { valid: false, error: 'Invalid image format. Supported formats: PNG, JPG, GIF, WebP, BMP' };
  }

  return { valid: true };
};

// Get image format from buffer
export const getImageFormat = (buffer: Buffer): string | null => {
  if (buffer.length < 8) return null;

  // PNG
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'png';
  }

  // JPEG
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'jpg';
  }

  // GIF
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'gif';
  }

  // WebP
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return 'webp';
  }

  // BMP
  if (buffer[0] === 0x42 && buffer[1] === 0x4D) {
    return 'bmp';
  }

  return null;
};

// Basic image info extraction (without external dependencies)
export const getImageInfo = (buffer: Buffer): ImageInfo | null => {
  const format = getImageFormat(buffer);
  if (!format) return null;

  try {
    let width = 0;
    let height = 0;
    let hasAlpha = false;

    switch (format) {
      case 'png':
        // PNG dimensions are at bytes 16-23
        if (buffer.length >= 24) {
          width = buffer.readUInt32BE(16);
          height = buffer.readUInt32BE(20);
          // PNG color type at byte 25 (if available)
          hasAlpha = buffer.length > 25 && (buffer[25] === 4 || buffer[25] === 6);
        }
        break;

      case 'jpg':
        // JPEG is more complex, this is a simplified version
        // Look for SOF0 (Start of Frame) marker
        for (let i = 2; i < buffer.length - 8; i++) {
          if (buffer[i] === 0xFF && buffer[i + 1] === 0xC0) {
            height = buffer.readUInt16BE(i + 5);
            width = buffer.readUInt16BE(i + 7);
            break;
          }
        }
        hasAlpha = false; // JPEG doesn't support transparency
        break;

      case 'gif':
        // GIF dimensions are at bytes 6-9
        if (buffer.length >= 10) {
          width = buffer.readUInt16LE(6);
          height = buffer.readUInt16LE(8);
          hasAlpha = true; // GIF supports transparency
        }
        break;

      case 'webp':
        // WebP is complex, simplified version
        if (buffer.length >= 30) {
          // Look for VP8 or VP8L chunk
          const chunk = buffer.toString('ascii', 12, 16);
          if (chunk === 'VP8 ') {
            width = buffer.readUInt16LE(26) & 0x3FFF;
            height = buffer.readUInt16LE(28) & 0x3FFF;
          } else if (chunk === 'VP8L') {
            const bits = buffer.readUInt32LE(21);
            width = (bits & 0x3FFF) + 1;
            height = ((bits >> 14) & 0x3FFF) + 1;
            hasAlpha = !!(bits >> 28);
          }
        }
        break;

      case 'bmp':
        // BMP dimensions are at bytes 18-25
        if (buffer.length >= 26) {
          width = buffer.readUInt32LE(18);
          height = buffer.readUInt32LE(22);
          hasAlpha = false; // Standard BMP doesn't support transparency
        }
        break;
    }

    return {
      width,
      height,
      format,
      size: buffer.length,
      hasAlpha,
    };
  } catch (error) {
    return null;
  }
};

// Create a solid color image buffer (simplified PNG generation)
export const createSolidColorImage = (
  width: number,
  height: number,
  color: string = '#000000'
): Buffer => {
  // This is a simplified implementation
  // In a real application, you'd use a proper image library like sharp or canvas
  
  // Convert hex color to RGB
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Create a simple bitmap-like structure
  // This is not a valid image format, just a placeholder
  const pixelCount = width * height;
  const buffer = Buffer.alloc(pixelCount * 3); // RGB

  for (let i = 0; i < pixelCount; i++) {
    buffer[i * 3] = r;
    buffer[i * 3 + 1] = g;
    buffer[i * 3 + 2] = b;
  }

  return buffer;
};

// Resize image for StreamDeck button (placeholder implementation)
export const resizeForStreamDeck = (
  imageBuffer: Buffer,
  deviceType: StreamDeckDeviceType,
  options: ImageProcessingOptions = {}
): ProcessedImage => {
  const targetSize = STREAMDECK_BUTTON_SIZES[deviceType];
  const imageInfo = getImageInfo(imageBuffer);

  if (!imageInfo) {
    throw new Error('Invalid image format');
  }

  // In a real implementation, you would use a proper image processing library
  // This is a placeholder that returns the original image with updated info
  const processedInfo: ImageInfo = {
    ...imageInfo,
    width: options.width || targetSize.width,
    height: options.height || targetSize.height,
  };

  return {
    data: imageBuffer, // In reality, this would be the resized image
    info: processedInfo,
  };
};

// Generate a text-based button image (placeholder)
export const generateTextButton = (
  text: string,
  width: number = 72,
  height: number = 72,
  options: {
    backgroundColor?: string;
    textColor?: string;
    fontSize?: number;
    fontFamily?: string;
  } = {}
): Buffer => {
  // This is a placeholder implementation
  // In a real application, you'd use canvas or similar to generate actual images
  
  const {
    backgroundColor = '#000000',
    textColor = '#FFFFFF',
    fontSize = 12,
    fontFamily = 'Arial',
  } = options;

  // Create a simple representation
  const metadata = JSON.stringify({
    type: 'text-button',
    text,
    width,
    height,
    backgroundColor,
    textColor,
    fontSize,
    fontFamily,
  });

  return Buffer.from(metadata, 'utf8');
};

// Image caching utilities
export class ImageCache {
  private cache = new Map<string, { data: Buffer; timestamp: number }>();
  private maxAge: number;
  private maxSize: number;

  constructor(maxAge: number = 3600000, maxSize: number = 100) { // 1 hour, 100 items
    this.maxAge = maxAge;
    this.maxSize = maxSize;
  }

  set(key: string, data: Buffer): void {
    // Remove expired entries
    this.cleanup();

    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  get(key: string): Buffer | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > this.maxAge) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  size(): number {
    this.cleanup();
    return this.cache.size;
  }
}

// Default image cache instance
export const imageCache = new ImageCache();