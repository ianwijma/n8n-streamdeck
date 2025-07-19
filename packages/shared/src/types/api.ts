export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  message?: string;
  timestamp: string;
  requestId?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ApiValidationError extends ApiError {
  code: 'VALIDATION_ERROR';
  details: {
    errors: ValidationError[];
  };
}

// HTTP Status Code enums
export enum HttpStatusCode {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  UNPROCESSABLE_ENTITY = 422,
  INTERNAL_SERVER_ERROR = 500,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
}

// Common API Error Codes
export enum ApiErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DEVICE_NOT_CONNECTED = 'DEVICE_NOT_CONNECTED',
  DEVICE_BUSY = 'DEVICE_BUSY',
  INVALID_BUTTON_INDEX = 'INVALID_BUTTON_INDEX',
  WORKFLOW_NOT_FOUND = 'WORKFLOW_NOT_FOUND',
  WEBHOOK_ERROR = 'WEBHOOK_ERROR',
  IMAGE_PROCESSING_ERROR = 'IMAGE_PROCESSING_ERROR',
}

// Request/Response interfaces for specific endpoints
export interface DeviceListRequest {
  includeDisconnected?: boolean;
  page?: number;
  limit?: number;
}

export interface DeviceListResponse extends PaginatedResponse<import('./device').Device> {}

export interface ButtonUpdateRequest {
  label?: string;
  icon?: string;
  action?: import('./device').ButtonAction;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
}

export interface ButtonUpdateResponse extends ApiResponse<import('./device').Button> {}

export interface WorkflowTriggerRequest {
  workflowId: string;
  payload?: Record<string, any>;
}

export interface WorkflowTriggerResponse extends ApiResponse<{
  executionId: string;
  status: 'triggered' | 'failed';
}> {}

// Health check response
export interface HealthCheckResponse extends ApiResponse<{
  status: 'healthy' | 'unhealthy';
  uptime: number;
  version: string;
  services: {
    database: 'connected' | 'disconnected';
    n8n: 'connected' | 'disconnected';
    streamdeck: 'connected' | 'disconnected';
  };
}> {}

// Utility functions for API responses
export const createSuccessResponse = <T>(
  data: T,
  message?: string,
  requestId?: string
): ApiResponse<T> => ({
  success: true,
  data,
  message,
  timestamp: new Date().toISOString(),
  requestId,
});

export const createErrorResponse = (
  error: ApiError,
  requestId?: string
): ApiResponse => ({
  success: false,
  error,
  timestamp: new Date().toISOString(),
  requestId,
});

export const createValidationErrorResponse = (
  errors: ValidationError[],
  requestId?: string
): ApiResponse => ({
  success: false,
  error: {
    code: ApiErrorCode.VALIDATION_ERROR,
    message: 'Validation failed',
    details: { errors },
  },
  timestamp: new Date().toISOString(),
  requestId,
});