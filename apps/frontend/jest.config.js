const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  displayName: 'frontend',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapping: {
    '^@n8n-streamdeck/shared$': '<rootDir>/../../packages/shared/src',
    '^@n8n-streamdeck/config$': '<rootDir>/../../packages/config/src',
  },
  testEnvironment: 'jest-environment-jsdom',
};

module.exports = createJestConfig(customJestConfig);