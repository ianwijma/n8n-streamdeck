module.exports = {
  displayName: 'backend',
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleNameMapping: {
    '^@n8n-streamdeck/shared$': '<rootDir>/../../packages/shared/src',
    '^@n8n-streamdeck/config$': '<rootDir>/../../packages/config/src',
  },

  // Coverage configuration
  collectCoverage: false, // Enable with --coverage flag
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/scripts/**',
    '!src/tests/**',
    '!src/**/__tests__/**',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // Test setup and teardown
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],

  // Timeout for tests
  testTimeout: 10000,

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,

  // Verbose output
  verbose: true,

  // Handle ES modules and other file types
  extensionsToTreatAsEsm: [],
  globals: {
    'ts-jest': {
      useESM: false,
    },
  },

  // Module name mapping for workspace packages and mocks
  moduleNameMapping: {
    '^@n8n-streamdeck/shared$': '<rootDir>/../../packages/shared/src',
    '^@n8n-streamdeck/config$': '<rootDir>/../../packages/config/src',
    '^@elgato-stream-deck/node$':
      '<rootDir>/src/tests/mocks/streamdeck.mock.ts',
  },
};
