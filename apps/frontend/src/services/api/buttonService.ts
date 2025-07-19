import apiClient from '@/utils/apiClient';
import {
  ButtonResponse,
  ButtonCreateRequest,
  ButtonUpdateRequest,
  ButtonIconUploadResponse,
} from '@/types/api';

export class ButtonService {
  private readonly basePath = '/api/devices';

  // Get all buttons for a device
  async getButtons(deviceId: string): Promise<ButtonResponse[]> {
    return apiClient.get<ButtonResponse[]>(
      `${this.basePath}/${deviceId}/buttons`
    );
  }

  // Get button by ID
  async getButton(deviceId: string, buttonId: string): Promise<ButtonResponse> {
    return apiClient.get<ButtonResponse>(
      `${this.basePath}/${deviceId}/buttons/${buttonId}`
    );
  }

  // Get button by position
  async getButtonByPosition(
    deviceId: string,
    position: number
  ): Promise<ButtonResponse | null> {
    try {
      return await apiClient.get<ButtonResponse>(
        `${this.basePath}/${deviceId}/buttons/position/${position}`
      );
    } catch (error: any) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  // Create button
  async createButton(
    deviceId: string,
    data: ButtonCreateRequest
  ): Promise<ButtonResponse> {
    return apiClient.post<ButtonResponse>(
      `${this.basePath}/${deviceId}/buttons`,
      data
    );
  }

  // Update button
  async updateButton(
    deviceId: string,
    buttonId: string,
    data: ButtonUpdateRequest
  ): Promise<ButtonResponse> {
    return apiClient.put<ButtonResponse>(
      `${this.basePath}/${deviceId}/buttons/${buttonId}`,
      data
    );
  }

  // Delete button
  async deleteButton(deviceId: string, buttonId: string): Promise<void> {
    return apiClient.delete<void>(
      `${this.basePath}/${deviceId}/buttons/${buttonId}`
    );
  }

  // Upload button icon
  async uploadButtonIcon(
    deviceId: string,
    buttonId: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<ButtonIconUploadResponse> {
    return apiClient.uploadFile<ButtonIconUploadResponse>(
      `${this.basePath}/${deviceId}/buttons/${buttonId}/icon`,
      file,
      onProgress
    );
  }

  // Delete button icon
  async deleteButtonIcon(
    deviceId: string,
    buttonId: string
  ): Promise<ButtonResponse> {
    return apiClient.delete<ButtonResponse>(
      `${this.basePath}/${deviceId}/buttons/${buttonId}/icon`
    );
  }

  // Test button action
  async testButtonAction(
    deviceId: string,
    buttonId: string
  ): Promise<{
    success: boolean;
    message: string;
    response?: any;
    duration?: number;
  }> {
    return apiClient.post<{
      success: boolean;
      message: string;
      response?: any;
      duration?: number;
    }>(`${this.basePath}/${deviceId}/buttons/${buttonId}/test`);
  }

  // Trigger button action manually
  async triggerButton(
    deviceId: string,
    buttonId: string
  ): Promise<{
    success: boolean;
    message: string;
    response?: any;
  }> {
    return apiClient.post<{
      success: boolean;
      message: string;
      response?: any;
    }>(`${this.basePath}/${deviceId}/buttons/${buttonId}/trigger`);
  }

  // Copy button configuration
  async copyButton(
    deviceId: string,
    buttonId: string,
    targetPosition: number
  ): Promise<ButtonResponse> {
    return apiClient.post<ButtonResponse>(
      `${this.basePath}/${deviceId}/buttons/${buttonId}/copy`,
      {
        targetPosition,
      }
    );
  }

  // Move button to different position
  async moveButton(
    deviceId: string,
    buttonId: string,
    newPosition: number
  ): Promise<ButtonResponse> {
    return apiClient.post<ButtonResponse>(
      `${this.basePath}/${deviceId}/buttons/${buttonId}/move`,
      {
        position: newPosition,
      }
    );
  }

  // Swap two buttons
  async swapButtons(
    deviceId: string,
    buttonId1: string,
    buttonId2: string
  ): Promise<{
    button1: ButtonResponse;
    button2: ButtonResponse;
  }> {
    return apiClient.post<{
      button1: ButtonResponse;
      button2: ButtonResponse;
    }>(`${this.basePath}/${deviceId}/buttons/${buttonId1}/swap`, {
      targetButtonId: buttonId2,
    });
  }

  // Clear all buttons on device
  async clearAllButtons(deviceId: string): Promise<{ deletedCount: number }> {
    return apiClient.delete<{ deletedCount: number }>(
      `${this.basePath}/${deviceId}/buttons`
    );
  }

  // Get button press statistics
  async getButtonStats(
    deviceId: string,
    buttonId?: string
  ): Promise<{
    totalPresses: number;
    pressesToday: number;
    lastPressed?: string;
    averageResponseTime?: number;
    successRate?: number;
  }> {
    const url = buttonId
      ? `${this.basePath}/${deviceId}/buttons/${buttonId}/stats`
      : `${this.basePath}/${deviceId}/buttons/stats`;

    return apiClient.get<{
      totalPresses: number;
      pressesToday: number;
      lastPressed?: string;
      averageResponseTime?: number;
      successRate?: number;
    }>(url);
  }

  // Export button configuration
  async exportButton(
    deviceId: string,
    buttonId: string
  ): Promise<{
    button: ButtonResponse;
    exportedAt: string;
  }> {
    return apiClient.get<{
      button: ButtonResponse;
      exportedAt: string;
    }>(`${this.basePath}/${deviceId}/buttons/${buttonId}/export`);
  }

  // Import button configuration
  async importButton(
    deviceId: string,
    position: number,
    buttonData: ButtonCreateRequest
  ): Promise<ButtonResponse> {
    return apiClient.post<ButtonResponse>(
      `${this.basePath}/${deviceId}/buttons/import`,
      {
        ...buttonData,
        position,
      }
    );
  }

  // Validate button action configuration
  async validateButtonAction(action: ButtonCreateRequest['action']): Promise<{
    valid: boolean;
    errors?: string[];
    warnings?: string[];
  }> {
    return apiClient.post<{
      valid: boolean;
      errors?: string[];
      warnings?: string[];
    }>('/api/buttons/validate-action', { action });
  }

  // Get available action templates
  async getActionTemplates(): Promise<
    Array<{
      id: string;
      name: string;
      description: string;
      type: string;
      template: any;
      category: string;
    }>
  > {
    return apiClient.get<
      Array<{
        id: string;
        name: string;
        description: string;
        type: string;
        template: any;
        category: string;
      }>
    >('/api/buttons/action-templates');
  }
}

// Create singleton instance
export const buttonService = new ButtonService();
export default buttonService;
