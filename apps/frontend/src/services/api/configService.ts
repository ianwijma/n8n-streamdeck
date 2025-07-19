import apiClient from '@/utils/apiClient';
import {
  AppConfigResponse,
  AppConfigUpdateRequest,
  HealthCheckResponse,
} from '@/types/api';

export class ConfigService {
  private readonly basePath = '/api/config';

  // Get application configuration
  async getConfig(): Promise<AppConfigResponse> {
    return apiClient.get<AppConfigResponse>(this.basePath);
  }

  // Update application configuration
  async updateConfig(data: AppConfigUpdateRequest): Promise<AppConfigResponse> {
    return apiClient.put<AppConfigResponse>(this.basePath, data);
  }

  // Reset configuration to defaults
  async resetConfig(): Promise<AppConfigResponse> {
    return apiClient.post<AppConfigResponse>(`${this.basePath}/reset`);
  }

  // Health check
  async healthCheck(): Promise<HealthCheckResponse> {
    return apiClient.get<HealthCheckResponse>('/api/health');
  }

  // Get application version
  async getVersion(): Promise<{
    version: string;
    buildDate: string;
    gitCommit?: string;
    environment: string;
  }> {
    return apiClient.get<{
      version: string;
      buildDate: string;
      gitCommit?: string;
      environment: string;
    }>('/api/version');
  }

  // Test N8N connection
  async testN8nConnection(
    baseUrl: string,
    apiKey?: string
  ): Promise<{
    success: boolean;
    message: string;
    version?: string;
    workflows?: number;
  }> {
    return apiClient.post<{
      success: boolean;
      message: string;
      version?: string;
      workflows?: number;
    }>(`${this.basePath}/test-n8n`, {
      baseUrl,
      apiKey,
    });
  }

  // Get system information
  async getSystemInfo(): Promise<{
    platform: string;
    arch: string;
    nodeVersion: string;
    memory: {
      total: number;
      used: number;
      free: number;
    };
    uptime: number;
    loadAverage: number[];
  }> {
    return apiClient.get<{
      platform: string;
      arch: string;
      nodeVersion: string;
      memory: {
        total: number;
        used: number;
        free: number;
      };
      uptime: number;
      loadAverage: number[];
    }>('/api/system');
  }

  // Get application logs
  async getLogs(params?: {
    level?: 'error' | 'warn' | 'info' | 'debug';
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    logs: Array<{
      timestamp: string;
      level: string;
      message: string;
      meta?: any;
    }>;
    total: number;
  }> {
    return apiClient.get<{
      logs: Array<{
        timestamp: string;
        level: string;
        message: string;
        meta?: any;
      }>;
      total: number;
    }>('/api/logs', { params });
  }

  // Export application configuration
  async exportConfig(): Promise<{
    config: AppConfigResponse;
    devices: any[];
    buttons: any[];
    exportedAt: string;
    version: string;
  }> {
    return apiClient.get<{
      config: AppConfigResponse;
      devices: any[];
      buttons: any[];
      exportedAt: string;
      version: string;
    }>(`${this.basePath}/export`);
  }

  // Import application configuration
  async importConfig(configData: {
    config?: Partial<AppConfigUpdateRequest>;
    devices?: any[];
    buttons?: any[];
    overwriteExisting?: boolean;
  }): Promise<{
    success: boolean;
    message: string;
    imported: {
      config: boolean;
      devices: number;
      buttons: number;
    };
  }> {
    return apiClient.post<{
      success: boolean;
      message: string;
      imported: {
        config: boolean;
        devices: number;
        buttons: number;
      };
    }>(`${this.basePath}/import`, configData);
  }

  // Clear application cache
  async clearCache(): Promise<{
    success: boolean;
    message: string;
    clearedItems: string[];
  }> {
    return apiClient.post<{
      success: boolean;
      message: string;
      clearedItems: string[];
    }>('/api/cache/clear');
  }

  // Get cache statistics
  async getCacheStats(): Promise<{
    size: number;
    keys: number;
    hitRate: number;
    missRate: number;
    memoryUsage: number;
  }> {
    return apiClient.get<{
      size: number;
      keys: number;
      hitRate: number;
      missRate: number;
      memoryUsage: number;
    }>('/api/cache/stats');
  }

  // Backup database
  async createBackup(): Promise<{
    success: boolean;
    message: string;
    backupId: string;
    filename: string;
    size: number;
  }> {
    return apiClient.post<{
      success: boolean;
      message: string;
      backupId: string;
      filename: string;
      size: number;
    }>('/api/backup');
  }

  // Restore database from backup
  async restoreBackup(backupId: string): Promise<{
    success: boolean;
    message: string;
    restoredAt: string;
  }> {
    return apiClient.post<{
      success: boolean;
      message: string;
      restoredAt: string;
    }>(`/api/backup/${backupId}/restore`);
  }

  // Get available backups
  async getBackups(): Promise<
    Array<{
      id: string;
      filename: string;
      size: number;
      createdAt: string;
      description?: string;
    }>
  > {
    return apiClient.get<
      Array<{
        id: string;
        filename: string;
        size: number;
        createdAt: string;
        description?: string;
      }>
    >('/api/backup');
  }
}

// Create singleton instance
export const configService = new ConfigService();
export default configService;
