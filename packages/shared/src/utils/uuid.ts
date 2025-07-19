// UUID v4 generator utility
export const generateUUID = (): string => {
  // Use crypto.randomUUID if available (Node.js 14.17.0+)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Generate a short UUID (8 characters)
export const generateShortUUID = (): string => {
  return generateUUID().split('-')[0];
};

// Generate a UUID with a specific prefix
export const generatePrefixedUUID = (prefix: string): string => {
  return `${prefix}-${generateUUID()}`;
};

// Validate UUID format
export const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// Extract timestamp from UUID v1 (if applicable)
export const extractTimestampFromUUID = (uuid: string): Date | null => {
  if (!isValidUUID(uuid)) {
    return null;
  }

  // This is a simplified implementation for UUID v1
  // UUID v4 (random) doesn't contain timestamp information
  const version = parseInt(uuid.charAt(14), 16);
  if (version !== 1) {
    return null; // Only UUID v1 contains timestamp
  }

  try {
    // Extract timestamp from UUID v1 format
    const timeLow = parseInt(uuid.substring(0, 8), 16);
    const timeMid = parseInt(uuid.substring(9, 13), 16);
    const timeHigh = parseInt(uuid.substring(14, 18), 16) & 0x0fff;
    
    // Combine timestamp parts
    const timestamp = (timeHigh << 32) | (timeMid << 16) | timeLow;
    
    // UUID timestamp is in 100-nanosecond intervals since October 15, 1582
    const uuidEpoch = new Date('1582-10-15T00:00:00.000Z').getTime();
    const unixTimestamp = uuidEpoch + (timestamp / 10000);
    
    return new Date(unixTimestamp);
  } catch {
    return null;
  }
};

// Generate UUID v1-like with timestamp (simplified)
export const generateTimestampUUID = (): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(16).substring(2, 14);
  
  // Create a pseudo UUID v1 format with timestamp
  const timeLow = (timestamp & 0xffffffff).toString(16).padStart(8, '0');
  const timeMid = ((timestamp >> 32) & 0xffff).toString(16).padStart(4, '0');
  const timeHigh = '1' + Math.random().toString(16).substring(2, 4);
  const clockSeq = Math.random().toString(16).substring(2, 6);
  const node = random.padStart(12, '0');
  
  return `${timeLow}-${timeMid}-${timeHigh}-${clockSeq}-${node}`;
};

// UUID utilities for different entity types
export const DeviceUUID = {
  generate: () => generatePrefixedUUID('dev'),
  validate: (uuid: string) => uuid.startsWith('dev-') && isValidUUID(uuid.substring(4)),
};

export const ButtonUUID = {
  generate: () => generatePrefixedUUID('btn'),
  validate: (uuid: string) => uuid.startsWith('btn-') && isValidUUID(uuid.substring(4)),
};

export const FolderUUID = {
  generate: () => generatePrefixedUUID('fld'),
  validate: (uuid: string) => uuid.startsWith('fld-') && isValidUUID(uuid.substring(4)),
};

export const ProfileUUID = {
  generate: () => generatePrefixedUUID('prf'),
  validate: (uuid: string) => uuid.startsWith('prf-') && isValidUUID(uuid.substring(4)),
};

export const EventUUID = {
  generate: () => generatePrefixedUUID('evt'),
  validate: (uuid: string) => uuid.startsWith('evt-') && isValidUUID(uuid.substring(4)),
};

// Batch UUID generation
export const generateUUIDs = (count: number, prefix?: string): string[] => {
  const uuids: string[] = [];
  for (let i = 0; i < count; i++) {
    uuids.push(prefix ? generatePrefixedUUID(prefix) : generateUUID());
  }
  return uuids;
};

// UUID sorting utilities
export const sortUUIDs = (uuids: string[]): string[] => {
  return [...uuids].sort();
};

export const sortUUIDsByTimestamp = (uuids: string[]): string[] => {
  return [...uuids].sort((a, b) => {
    const timestampA = extractTimestampFromUUID(a);
    const timestampB = extractTimestampFromUUID(b);
    
    if (!timestampA && !timestampB) return a.localeCompare(b);
    if (!timestampA) return 1;
    if (!timestampB) return -1;
    
    return timestampA.getTime() - timestampB.getTime();
  });
};

// UUID conversion utilities
export const uuidToBuffer = (uuid: string): Buffer => {
  const hex = uuid.replace(/-/g, '');
  return Buffer.from(hex, 'hex');
};

export const bufferToUUID = (buffer: Buffer): string => {
  if (buffer.length !== 16) {
    throw new Error('Buffer must be exactly 16 bytes for UUID conversion');
  }
  
  const hex = buffer.toString('hex');
  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20, 32),
  ].join('-');
};

// Namespace UUID generation (simplified UUID v5)
export const generateNamespaceUUID = (namespace: string, name: string): string => {
  // This is a simplified implementation
  // A proper UUID v5 would use SHA-1 hashing
  const combined = `${namespace}:${name}`;
  let hash = 0;
  
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert hash to hex and format as UUID
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  const random = Math.random().toString(16).substring(2, 24);
  const fullHex = (hex + random).substring(0, 32);
  
  return [
    fullHex.substring(0, 8),
    fullHex.substring(8, 12),
    '5' + fullHex.substring(13, 16), // Version 5
    '8' + fullHex.substring(17, 20), // Variant bits
    fullHex.substring(20, 32),
  ].join('-');
};

// Common namespaces
export const UUID_NAMESPACES = {
  DNS: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
  URL: '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
  OID: '6ba7b812-9dad-11d1-80b4-00c04fd430c8',
  X500: '6ba7b814-9dad-11d1-80b4-00c04fd430c8',
  STREAMDECK: generateUUID(), // Custom namespace for StreamDeck entities
} as const;