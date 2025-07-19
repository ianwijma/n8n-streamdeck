# E2E Testing with Playwright

This directory contains comprehensive end-to-end tests for the N8N StreamDeck frontend application using Playwright.

## Test Structure

```
e2e/
├── fixtures/           # Test data and factories
├── mocks/             # API mocking services
├── pages/             # Page Object Model classes
├── utils/             # Test utilities and helpers
├── *.spec.ts          # Test files
├── auth.setup.ts      # Authentication and setup
└── README.md          # This file
```

## Test Categories

### Core Tests

- **smoke.spec.ts** - Basic application loading and functionality
- **device-management.spec.ts** - Device connection, discovery, and management
- **button-configuration.spec.ts** - Button creation, editing, and deletion

### Integration Tests

- **n8n-integration.spec.ts** - N8N workflow integration and execution
- **advanced-scenarios.spec.ts** - Complex multi-device and real-time scenarios
- **comprehensive.spec.ts** - Full workflow demonstrations

## Page Object Model

The tests use the Page Object Model pattern for maintainable and reusable test code:

- **BasePage** - Common functionality for all pages
- **DeviceListPage** - Device listing and management
- **DeviceDetailPage** - Individual device configuration
- **ButtonEditorPage** - Button configuration modal

## Mock Services

**StreamDeckMockService** provides comprehensive API mocking:

- Device management endpoints
- Button configuration endpoints
- WebSocket event simulation
- Error scenario simulation

## Test Utilities

**TestHelpers** provides utilities for:

- Stable element waiting
- Retry mechanisms
- Network simulation
- Screenshot capture
- Error logging

## Running Tests

### Local Development

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI mode
npm run test:e2e:ui

# Run specific test file
npx playwright test device-management.spec.ts

# Run in headed mode (see browser)
npm run test:e2e:headed

# Debug mode
npm run test:e2e:debug
```

### Browser Selection

```bash
# Run on specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit

# Run on all browsers
npx playwright test
```

### Test Filtering

```bash
# Run tests matching pattern
npx playwright test --grep "device connection"

# Run specific test file
npx playwright test smoke.spec.ts

# Run tests in specific directory
npx playwright test advanced-scenarios/
```

## Configuration

Tests are configured in `playwright.config.ts`:

- **Multi-browser support** - Chrome, Firefox, Safari, Edge
- **Parallel execution** - Tests run in parallel for speed
- **Automatic retries** - Failed tests retry automatically in CI
- **Screenshots and videos** - Captured on failure
- **Test reports** - HTML reports with detailed results

## CI/CD Integration

### GitHub Actions

Tests run automatically on:

- Pull requests to main/develop branches
- Push to main/develop branches
- Manual workflow dispatch

### Test Artifacts

- Screenshots on failure
- Video recordings
- HTML test reports
- Test result summaries

## Best Practices

### Writing Tests

1. Use Page Object Model for UI interactions
2. Use data-testid attributes for element selection
3. Wait for stable elements before interaction
4. Use retry mechanisms for flaky operations
5. Mock external dependencies

### Test Data

1. Use factories for creating test data
2. Clean up test data after tests
3. Use unique identifiers to avoid conflicts
4. Mock API responses consistently

### Error Handling

1. Take screenshots on failure
2. Log console errors
3. Provide meaningful error messages
4. Use proper timeouts and waits

## Debugging Tests

### Local Debugging

```bash
# Run with browser visible
npx playwright test --headed

# Debug specific test
npx playwright test --debug device-management.spec.ts

# Use Playwright Inspector
npx playwright test --ui
```

### CI Debugging

1. Check test artifacts in GitHub Actions
2. Download screenshots and videos
3. Review HTML test reports
4. Check console logs in test output

## Test Environment

### Prerequisites

- Node.js 18+
- pnpm package manager
- Playwright browsers installed

### Setup

```bash
# Install dependencies
pnpm install

# Install Playwright browsers
npx playwright install

# Run setup tests
npx playwright test --project=setup
```

### Environment Variables

- `CI=true` - Enables CI-specific configurations
- `NODE_ENV=test` - Sets test environment
- `REDIS_URL` - Redis connection for backend tests

## Maintenance

### Updating Tests

1. Update page objects when UI changes
2. Update mock data when API changes
3. Add new test scenarios for new features
4. Remove obsolete tests

### Performance

1. Use parallel execution
2. Optimize wait times
3. Use efficient selectors
4. Clean up resources

### Monitoring

1. Track test execution times
2. Monitor flaky test rates
3. Review test coverage
4. Update browser versions

## Troubleshooting

### Common Issues

**Port conflicts**

```bash
# Kill processes using test ports
lsof -ti:3002,3003 | xargs kill -9
```

**Browser installation**

```bash
# Reinstall browsers
npx playwright install --force
```

**Test timeouts**

- Increase timeout in playwright.config.ts
- Check for slow network requests
- Optimize test wait conditions

**Flaky tests**

- Use TestHelpers retry mechanisms
- Add proper wait conditions
- Check for race conditions

### Getting Help

1. Check Playwright documentation
2. Review test logs and artifacts
3. Use Playwright community resources
4. Create issues for persistent problems
