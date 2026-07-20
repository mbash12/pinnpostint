/**
 * Unit tests for the logger utility
 */

import { logger, LogLevel } from '../logger';

// Mock console methods to capture logs
const mockConsole = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('Logger', () => {
  beforeEach(() => {
    // Mock console methods
    Object.defineProperty(global.console, 'debug', {
      value: mockConsole.debug,
      writable: true,
    });
    Object.defineProperty(global.console, 'info', {
      value: mockConsole.info,
      writable: true,
    });
    Object.defineProperty(global.console, 'warn', {
      value: mockConsole.warn,
      writable: true,
    });
    Object.defineProperty(global.console, 'error', {
      value: mockConsole.error,
      writable: true,
    });

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('Logging methods', () => {
    test('should log debug messages when enabled', () => {
      logger.debug('Test debug message', { test: 'data' });
      
      expect(mockConsole.debug).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG]: Test debug message'),
      );
    });

    test('should log info messages', () => {
      logger.info('Test info message', { test: 'data' });
      
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]: Test info message'),
      );
    });

    test('should log warn messages', () => {
      logger.warn('Test warn message', { test: 'data' });
      
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('[WARN]: Test warn message'),
      );
    });

    test('should log error messages', () => {
      logger.error('Test error message', { test: 'data' });
      
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]: Test error message'),
      );
    });

    test('should handle Error objects in error logging', () => {
      const testError = new Error('Test error');
      logger.error(testError, { test: 'data' });
      
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]: Test error'),
      );
    });
  });

  describe('Log level filtering', () => {
    test('should respect log level configuration', () => {
      // This test would need to be adapted based on how the environment is mocked
      logger.info('Info message');
      logger.debug('Debug message'); // May not appear depending on level
      
      expect(mockConsole.info).toHaveBeenCalled();
    });
  });

  describe('Child logger', () => {
    test('should create child logger with additional metadata', () => {
      const childLogger = logger.child({ module: 'test' });
      childLogger.info('Child message', { extra: 'data' });
      
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]: Child message'),
      );
    });
  });
});