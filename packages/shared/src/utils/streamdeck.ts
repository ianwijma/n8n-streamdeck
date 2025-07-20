import {
  DeviceType,
  DEVICE_BUTTON_LAYOUTS,
  ButtonPosition,
} from '../types/device';

/**
 * Convert a linear button index to row/column position
 */
export const indexToPosition = (
  index: number,
  deviceType: DeviceType
): ButtonPosition => {
  const layout = DEVICE_BUTTON_LAYOUTS[deviceType];
  const row = Math.floor(index / layout.columns);
  const column = index % layout.columns;

  return {
    row,
    column,
    index,
  };
};

/**
 * Convert row/column position to linear button index
 */
export const positionToIndex = (
  row: number,
  column: number,
  deviceType: DeviceType
): number => {
  const layout = DEVICE_BUTTON_LAYOUTS[deviceType];
  return row * layout.columns + column;
};

/**
 * Check if a button position is valid for the given device type
 */
export const isValidPosition = (
  row: number,
  column: number,
  deviceType: DeviceType
): boolean => {
  const layout = DEVICE_BUTTON_LAYOUTS[deviceType];
  return (
    row >= 0 && row < layout.rows && column >= 0 && column < layout.columns
  );
};

/**
 * Check if a button index is valid for the given device type
 */
export const isValidIndex = (
  index: number,
  deviceType: DeviceType
): boolean => {
  const layout = DEVICE_BUTTON_LAYOUTS[deviceType];
  const totalButtons = layout.rows * layout.columns;
  return index >= 0 && index < totalButtons;
};

/**
 * Get all button positions for a device type
 */
export const getAllPositions = (deviceType: DeviceType): ButtonPosition[] => {
  const layout = DEVICE_BUTTON_LAYOUTS[deviceType];
  const positions: ButtonPosition[] = [];

  for (let row = 0; row < layout.rows; row++) {
    for (let column = 0; column < layout.columns; column++) {
      const index = positionToIndex(row, column, deviceType);
      positions.push({ row, column, index });
    }
  }

  return positions;
};

/**
 * Get the device layout information
 */
export const getDeviceLayout = (deviceType: DeviceType) => {
  return DEVICE_BUTTON_LAYOUTS[deviceType];
};

/**
 * Calculate the total number of buttons for a device type
 */
export const getTotalButtons = (deviceType: DeviceType): number => {
  const layout = DEVICE_BUTTON_LAYOUTS[deviceType];
  return layout.rows * layout.columns;
};
