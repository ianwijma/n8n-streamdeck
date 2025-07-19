import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
} from 'axios';

// Extend axios config to include metadata
declare module 'axios' {
  interface InternalAxiosRequestConfig {
    metadata?: {
      startTime: Date;
    };
  }
}

export interface ApiError {
  message: string;
  status: number;
  code?: string;
  details?: any;
}

export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add auth token if available
        const token = this.getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add request timestamp for debugging
        config.metadata = { startTime: new Date() };

        console.log(
          `🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`
        );
        return config;
      },
      (error) => {
        console.error('❌ Request Error:', error);
        return Promise.reject(this.handleError(error));
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        const duration = response.config.metadata?.startTime
          ? new Date().getTime() - response.config.metadata.startTime.getTime()
          : 0;
        console.log(
          `✅ API Response: ${response.config.method?.toUpperCase()} ${response.config.url} (${duration}ms)`
        );

        return response;
      },
      (error: AxiosError) => {
        const duration = error.config?.metadata?.startTime
          ? new Date().getTime() - error.config.metadata.startTime.getTime()
          : 0;

        console.error(
          `❌ API Error: ${error.config?.method?.toUpperCase()} ${error.config?.url} (${duration}ms)`,
          error.response?.data
        );

        return Promise.reject(this.handleError(error));
      }
    );
  }

  private getAuthToken(): string | null {
    // Get token from localStorage or other storage
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return null;
  }

  private handleError(error: AxiosError): ApiError {
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      return {
        message: (data as any)?.message || error.message || 'An error occurred',
        status,
        code: (data as any)?.code,
        details: (data as any)?.details,
      };
    } else if (error.request) {
      // Request was made but no response received
      return {
        message: 'Network error - please check your connection',
        status: 0,
        code: 'NETWORK_ERROR',
      };
    } else {
      // Something else happened
      return {
        message: error.message || 'An unexpected error occurred',
        status: 0,
        code: 'UNKNOWN_ERROR',
      };
    }
  }

  // Generic HTTP methods
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<ApiResponse<T>>(url, config);
    return response.data.data;
  }

  async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.post<ApiResponse<T>>(url, data, config);
    return response.data.data;
  }

  async put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.put<ApiResponse<T>>(url, data, config);
    return response.data.data;
  }

  async patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.patch<ApiResponse<T>>(url, data, config);
    return response.data.data;
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<ApiResponse<T>>(url, config);
    return response.data.data;
  }

  // File upload method
  async uploadFile<T = any>(
    url: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.client.post<ApiResponse<T>>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(progress);
        }
      },
    });

    return response.data.data;
  }

  // Paginated requests
  async getPaginated<T = any>(
    url: string,
    params?: { page?: number; limit?: number; [key: string]: any }
  ): Promise<PaginatedResponse<T>> {
    const response = await this.client.get<PaginatedResponse<T>>(url, {
      params,
    });
    return response.data;
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.get('/api/health');
  }

  // Set auth token
  setAuthToken(token: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  }

  // Clear auth token
  clearAuthToken() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  }
}

// Create singleton instance
export const apiClient = new ApiClient();
export default apiClient;
