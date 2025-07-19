module.exports = {
  projects: [
    '<rootDir>/apps/backend',
    '<rootDir>/apps/frontend',
    '<rootDir>/apps/n8n-node',
    '<rootDir>/packages/shared',
    '<rootDir>/packages/config',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
};