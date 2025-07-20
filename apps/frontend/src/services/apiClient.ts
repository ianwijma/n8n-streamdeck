/**
 * Enhanced API Client with Error Handling and Retry Logic
 *
 * This service provides:
 * - Automatic retry logic with exponential backoff
 * - Request/response interceptors
 * - Error handling and transformation
 * - Offline detection and queuing
 * - Request cancellation
 * - Performance monitoring
 */

import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
  CancelTokenSource,
} from 'axios';
import { reportError } from './errorReporting';

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  statusCode: number;
  isRetryable: boolean;
  timestamp: string;
  requestId?: string;
}

export interface RetryConfig {
  retries: number;
  retryDelay: number;
  retryCondition?: (error: AxiosError) => boolean;
  exponentialBackoff?: boolean;
}

export interface ApiClientConfig {
  baseURL?: string;
  timeout?: number;
  retryConfig?: RetryConfig;
  enableOfflineQueue?: boolean;
  enablePerformanceMonitoring?: boolean;
}

interface QueuedRequest {
  config: AxiosRequestConfig;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timestamp: number;
}

class ApiClient {
  private static instance: ApiClient;
  private axiosInstance: AxiosInstance;
  private retryConfig: RetryConfig;
  private offlineQueue: QueuedRequest[] = [];
  private isOnline = true;
  private enableOfflineQueue: boolean;
  private enablePerformanceMonitoring: boolean;
  private cancelTokens = new Map<string, CancelTokenSource>();

  constructor(config: ApiClientConfig = {}) {
    this.retryConfig = {
      retries: 3,
      retryDelay: 1000,
      exponentialBackoff: true,
      retryCondition: this.defaultRetryCondition,
      ...config.retryConfig,
    };

    this.enableOfflineQueue = config.enableOfflineQueue ?? true;
    this.enablePerformanceMonitoring =
      config.enablePerformanceMonitoring ?? true;

    this.axiosInstance = axios.create({
      baseURL: config.baseURL || '/api',
      timeout: config.timeout || 30000,
      withCredentials: true, // Enable sending cookies with requests
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
    this.setupOnlineStatusListener();
  }

  static getInstance(config?: ApiClientConfig): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient(config);
    }
    return ApiClient.instance;
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      (config) => {
        // Add request ID for tracking
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2)}`;
        config.headers = config.headers || {};
        (config.headers as any)['X-Request-ID'] = requestId;

        // Performance monitoring
        if (this.enablePerformanceMonitoring) {
          (config as any).startTime = Date.now();
        }

        return config;
      },
      (error) => {
        return Promise.reject(this.transformError(error));
      }
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => {
        // Performance monitoring
        if (
          this.enablePerformanceMonitoring &&
          (response.config as any).startTime
        ) {
          const duration = Date.now() - (response.config as any).startTime;
          this.recordPerformanceMetric(
            response.config,
            duration,
            response.status
          );
        }

        return response;
      },
      async (error) => {
        // Performance monitoring for errors
        if (this.enablePerformanceMonitoring && error.config?.startTime) {
          const duration = Date.now() - error.config.startTime;
          this.recordPerformanceMetric(
            error.config,
            duration,
            error.response?.status || 0
          );
        }

        // Handle retry logic
        if (this.shouldRetry(error)) {
          return this.retryRequest(error);
        }

        return Promise.reject(this.transformError(error));
      }
    );
  }

  private setupOnlineStatusListener(): void {
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine;

      window.addEventListener('online', () => {
        this.isOnline = true;
        this.processOfflineQueue();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
      });
    }
  }

  private defaultRetryCondition(error: AxiosError): boolean {
    // Retry on network errors or 5xx server errors
    return (
      !error.response ||
      error.code === 'NETWORK_ERROR' ||
      error.code === 'ECONNABORTED' ||
      (error.response.status >= 500 && error.response.status < 600) ||
      error.response.status === 429
    ); // Rate limited
  }

  private shouldRetry(error: AxiosError): boolean {
    const config = error.config as any;

    // Don't retry if retries are disabled or exhausted
    if (!config || config.__retryCount >= this.retryConfig.retries) {
      return false;
    }

    // Check retry condition
    return this.retryConfig.retryCondition
      ? this.retryConfig.retryCondition(error)
      : this.defaultRetryCondition(error);
  }

  private async retryRequest(error: AxiosError): Promise<AxiosResponse> {
    const config = error.config as any;
    config.__retryCount = config.__retryCount || 0;
    config.__retryCount++;

    // Calculate delay with exponential backoff
    let delay = this.retryConfig.retryDelay;
    if (this.retryConfig.exponentialBackoff) {
      delay *= Math.pow(2, config.__retryCount - 1);
    }

    // Add jitter to prevent thundering herd
    delay += Math.random() * 1000;

    // Wait before retrying
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Log retry attempt
    console.warn(
      `Retrying request (${config.__retryCount}/${this.retryConfig.retries}):`,
      {
        url: config.url,
        method: config.method,
        error: error.message,
      }
    );

    return this.axiosInstance.request(config);
  }

  private transformError(error: AxiosError): ApiError {
    const apiError: ApiError = {
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred',
      statusCode: 500,
      isRetryable: false,
      timestamp: new Date().toISOString(),
    };

    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      apiError.statusCode = status;
      apiError.requestId = error.response.headers['x-request-id'];

      if (data && typeof data === 'object') {
        const errorData = data as any;
        apiError.code = errorData.error?.code || `HTTP_${status}`;
        apiError.message =
          errorData.error?.message || errorData.message || error.message;
        apiError.details = errorData.error?.details || errorData.details;
      } else {
        apiError.code = `HTTP_${status}`;
        apiError.message = error.message;
      }

      // Determine if error is retryable
      apiError.isRetryable = status >= 500 || status === 429;
    } else if (error.request) {
      // Network error
      apiError.code = 'NETWORK_ERROR';
      apiError.message = 'Network error - please check your connection';
      apiError.statusCode = 0;
      apiError.isRetryable = true;
    } else {
      // Request setup error
      apiError.code = 'REQUEST_ERROR';
      apiError.message = error.message;
      apiError.statusCode = 0;
      apiError.isRetryable = false;
    }

    // Report error for monitoring
    reportError(new Error(apiError.message), {
      type: 'api_error',
      code: apiError.code,
      statusCode: apiError.statusCode,
      url: error.config?.url,
      method: error.config?.method,
      isRetryable: apiError.isRetryable,
    });

    return apiError;
  }

  private recordPerformanceMetric(
    config: AxiosRequestConfig,
    duration: number,
    statusCode: number
  ): void {
    // This would typically send metrics to your monitoring service
    if (process.env.NODE_ENV === 'development') {
      console.log('API Performance:', {
        url: config.url,
        method: config.method,
        duration,
        statusCode,
      });
    }

    // Could send to analytics service
    // analytics.track('api_request', { url, method, duration, statusCode });
  }

  private async processOfflineQueue(): Promise<void> {
    if (!this.enableOfflineQueue || this.offlineQueue.length === 0) {
      return;
    }

    console.log(`Processing ${this.offlineQueue.length} queued requests`);

    const queue = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const queuedRequest of queue) {
      try {
        const response = await this.axiosInstance.request(queuedRequest.config);
        queuedRequest.resolve(response);
      } catch (error) {
        queuedRequest.reject(error);
      }
    }
  }

  // Public API methods
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    if (!this.isOnline && this.enableOfflineQueue) {
      return this.queueRequest({ ...config, method: 'GET', url });
    }

    const response = await this.axiosInstance.get<T>(url, config);
    return response.data;
  }

  async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    if (!this.isOnline && this.enableOfflineQueue) {
      return this.queueRequest({ ...config, method: 'POST', url, data });
    }

    const response = await this.axiosInstance.post<T>(url, data, config);
    return response.data;
  }

  async put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    if (!this.isOnline && this.enableOfflineQueue) {
      return this.queueRequest({ ...config, method: 'PUT', url, data });
    }

    const response = await this.axiosInstance.put<T>(url, data, config);
    return response.data;
  }

  async patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    if (!this.isOnline && this.enableOfflineQueue) {
      return this.queueRequest({ ...config, method: 'PATCH', url, data });
    }

    const response = await this.axiosInstance.patch<T>(url, data, config);
    return response.data;
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    if (!this.isOnline && this.enableOfflineQueue) {
      return this.queueRequest({ ...config, method: 'DELETE', url });
    }

    const response = await this.axiosInstance.delete<T>(url, config);
    return response.data;
  }

  private queueRequest(config: AxiosRequestConfig): Promise<any> {
    return new Promise((resolve, reject) => {
      this.offlineQueue.push({
        config,
        resolve,
        reject,
        timestamp: Date.now(),
      });

      // Clean up old queued requests (older than 5 minutes)
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      this.offlineQueue = this.offlineQueue.filter(
        (req) => req.timestamp > fiveMinutesAgo
      );
    });
  }

  // Request cancellation
  cancelRequest(requestId: string): void {
    const cancelToken = this.cancelTokens.get(requestId);
    if (cancelToken) {
      cancelToken.cancel('Request cancelled by user');
      this.cancelTokens.delete(requestId);
    }
  }

  cancelAllRequests(): void {
    this.cancelTokens.forEach((cancelToken) => {
      cancelToken.cancel('All requests cancelled');
    });
    this.cancelTokens.clear();
  }

  // Utility methods
  isOnlineStatus(): boolean {
    return this.isOnline;
  }

  getQueueSize(): number {
    return this.offlineQueue.length;
  }

  clearQueue(): void {
    this.offlineQueue = [];
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    try {
      const response = await this.get('/health');
      return response;
    } catch (error) {
      throw this.transformError(error as AxiosError);
    }
  }
}

// Export singleton instance
export const apiClient = ApiClient.getInstance({
  enableOfflineQueue: true,
  enablePerformanceMonitoring: true,
  retryConfig: {
    retries: 3,
    retryDelay: 1000,
    exponentialBackoff: true,
  },
});

// Export types and class
export { ApiClient };
export default apiClient;
