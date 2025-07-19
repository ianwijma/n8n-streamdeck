module.exports = {
  displayName: 'n8n-node',
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
};