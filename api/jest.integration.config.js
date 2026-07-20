/**
 * Jest Configuration for Integration Tests
 * Specialized configuration for cross-application integration testing
 */

module.exports = {
  // Use the same base configuration as unit tests
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Test file patterns for integration tests
  testMatch: [
    '**/src/tests/integration/**/*.test.ts'
  ],
  
  // Setup files (commented out until tests are created)
  // setupFilesAfterEnv: [
  //   '<rootDir>/src/tests/setup.ts'
  // ],
  
  // Module paths
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage/integration',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json'
  ],
  
  // Coverage thresholds for integration tests
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // Files to collect coverage from
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/tests/**',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts'
  ],
  
  // Test timeout (integration tests may take longer)
  testTimeout: 60000,
  
  // Verbose output for better debugging
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true,
  
  // Transform configuration
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  
  // Module file extensions
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'node'
  ],
  
  // Global setup and teardown (commented out until tests are created)
  // globalSetup: '<rootDir>/src/tests/integration/global-setup.ts',
  // globalTeardown: '<rootDir>/src/tests/integration/global-teardown.ts',
  
  // Test results processor (commented out until tests are created)
  // testResultsProcessor: '<rootDir>/src/tests/integration/results-processor.ts',
  
  // Reporter configuration
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './reports',
        filename: 'integration-test-report.html',
        expand: true,
        hideIcon: false,
        pageTitle: 'Pin N Post Integration Test Report'
      }
    ]
  ],
  
  // Environment variables for tests
  testEnvironmentOptions: {
    NODE_ENV: 'test'
  },
  
  // Force exit after tests complete
  forceExit: true,
  
  // Detect open handles
  detectOpenHandles: true,
  
  // Maximum number of concurrent workers
  maxWorkers: 1, // Run integration tests sequentially to avoid conflicts
  
  // Bail after first test failure (optional)
  bail: false,
  
  // Silent mode (set to true to reduce output)
  silent: false
};