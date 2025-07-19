import apiClient from '@/utils/apiClient';
import {
  DeviceResponse,
  DeviceConnectionRequest,
  DeviceUpdateRequest,
  DeviceStatsResponse,
  DeviceConfigExport,
  DeviceConfigImport,
  PaginatedResponse,
} from '@/types/api';

export class DeviceService {
  private readonly basePath = '/api/devices';

  // Get all devices
  async getDevices(): Promise<DeviceResponse[]> {
    return apiClient.get<DeviceResponse[]>(this.basePath);
  }

  // Get paginated devices
  async getDevicesPaginated(params?: {
    page?: number;
    limit?: number;
    connected?: boolean;
    search?: string;
  }): Promise<PaginatedResponse<DeviceResponse>> {
    return apiClient.getPaginated<DeviceResponse>(this.basePath, params);
  }

  // Get device by ID
  async getDevice(deviceId: string): Promise<DeviceResponse> {
    return apiClient.get<DeviceResponse>(`${this.basePath}/${deviceId}`);
  }

  // Update device
  async updateDevice(
    deviceId: string,
    data: DeviceUpdateRequest
  ): Promise<DeviceResponse> {
    return apiClient.put<DeviceResponse>(`${this.basePath}/${deviceId}`, data);
  }

  // Connect device
  async connectDevice(deviceId: string): Promise<DeviceResponse> {
    return apiClient.post<DeviceResponse>(
      `${this.basePath}/${deviceId}/connect`
    );
  }

  // Disconnect device
  async disconnectDevice(deviceId: string): Promise<DeviceResponse> {
    return apiClient.post<DeviceResponse>(
      `${this.basePath}/${deviceId}/disconnect`
    );
  }

  // Delete device
  async deleteDevice(deviceId: string): Promise<void> {
    return apiClient.delete<void>(`${this.basePath}/${deviceId}`);
  }

  // Scan for new devices
  async scanDevices(): Promise<DeviceResponse[]> {
    return apiClient.post<DeviceResponse[]>(`${this.basePath}/scan`);
  }

  // Reset device (clear all buttons)
  async resetDevice(deviceId: string): Promise<DeviceResponse> {
    return apiClient.post<DeviceResponse>(`${this.basePath}/${deviceId}/reset`);
  }

  // Get device statistics
  async getDeviceStats(deviceId?: string): Promise<DeviceStatsResponse> {
    const url = deviceId
      ? `${this.basePath}/${deviceId}/stats`
      : `${this.basePath}/stats`;
    return apiClient.get<DeviceStatsResponse>(url);
  }

  // Export device configuration
  async exportDeviceConfig(deviceId: string): Promise<DeviceConfigExport> {
    return apiClient.get<DeviceConfigExport>(
      `${this.basePath}/${deviceId}/export`
    );
  }

  // Import device configuration
  async importDeviceConfig(
    deviceId: string,
    config: DeviceConfigImport
  ): Promise<DeviceResponse> {
    return apiClient.post<DeviceResponse>(
      `${this.basePath}/${deviceId}/import`,
      config
    );
  }

  // Test device connection
  async testDevice(
    deviceId: string
  ): Promise<{ success: boolean; message: string }> {
    return apiClient.post<{ success: boolean; message: string }>(
      `${this.basePath}/${deviceId}/test`
    );
  }

  // Get device firmware info
  async getDeviceFirmware(deviceId: string): Promise<{
    current: string;
    latest: string;
    updateAvailable: boolean;
  }> {
    return apiClient.get<{
      current: string;
      latest: string;
      updateAvailable: boolean;
    }>(`${this.basePath}/${deviceId}/firmware`);
  }

  // Update device firmware
  async updateDeviceFirmware(deviceId: string): Promise<{
    success: boolean;
    message: string;
    progress?: number;
  }> {
    return apiClient.post<{
      success: boolean;
      message: string;
      progress?: number;
    }>(`${this.basePath}/${deviceId}/firmware/update`);
  }

  // Set device brightness
  async setDeviceBrightness(
    deviceId: string,
    brightness: number
  ): Promise<DeviceResponse> {
    return apiClient.post<DeviceResponse>(
      `${this.basePath}/${deviceId}/brightness`,
      {
        brightness: Math.max(0, Math.min(100, brightness)),
      }
    );
  }

  // Get device logs
  async getDeviceLogs(
    deviceId: string,
    params?: {
      limit?: number;
      offset?: number;
      level?: 'error' | 'warn' | 'info' | 'debug';
    }
  ): Promise<{
    logs: Array<{
      timestamp: string;
      level: string;
      message: string;
      data?: any;
    }>;
    total: number;
  }> {
    return apiClient.get<{
      logs: Array<{
        timestamp: string;
        level: string;
        message: string;
        data?: any;
      }>;
      total: number;
    }>(`${this.basePath}/${deviceId}/logs`, { params });
  }
}

// Create singleton instance
export const deviceService = new DeviceService();
export default deviceService;
