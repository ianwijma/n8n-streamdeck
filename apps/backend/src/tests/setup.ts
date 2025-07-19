import { jest } from '@jest/globals';

// Global test setup
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
  process.env.PORT = '0'; // Use random port for tests
  process.env.N8N_BASE_URL = 'http://localhost:5678';
  process.env.N8N_API_KEY = 'test-api-key';
});

// Global test teardown
afterAll(() => {
  // Clean up any global resources
});

// Mock console methods to reduce noise during tests
const originalConsole = { ...console };

beforeEach(() => {
  // Reset console mocks before each test
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.error = originalConsole.error; // Keep error for debugging
});

afterEach(() => {
  // Restore console after each test
  Object.assign(console, originalConsole);
});

// Increase timeout for integration tests
jest.setTimeout(10000);

// Mock timers
jest.useFakeTimers();

export {};
