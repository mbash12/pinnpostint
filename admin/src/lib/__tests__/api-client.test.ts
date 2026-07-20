/**
 * Unit tests for the API client
 */

import { apiClient } from '../api-client';
import { logger } from '../../utils/logger';

// Mock fetch
global.fetch = jest.fn();

// Mock console for logger
const mockConsole = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('ApiClient', () => {
  beforeEach(() => {
    // Reset fetch mock
    (global.fetch as jest.MockedFunction<typeof fetch>).mockClear();
    
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

  describe('GET requests', () => {
    test('should handle successful requests', async () => {
      const mockResponse = { success: true, data: { id: 1, name: 'Test' } };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: {
          get: () => 'application/json',
        },
      } as Response);

      const result = await apiClient.get('/test');
      
      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    test('should handle error responses', async () => {
      const mockErrorResponse = { 
        success: false, 
        error: { code: 'NOT_FOUND', message: 'Resource not found' } 
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => mockErrorResponse,
        headers: {
          get: () => 'application/json',
        },
      } as Response);

      await expect(apiClient.get('/test')).rejects.toThrow('Resource not found');
    });

    test('should handle network errors', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(
        new TypeError('Network error')
      );

      await expect(apiClient.get('/test')).rejects.toThrow('Network error: Unable to reach the server. Please check your connection.');
    });
  });

  describe('POST requests', () => {
    test('should handle successful POST requests', async () => {
      const testData = { name: 'Test Item' };
      const mockResponse = { success: true, data: { id: 1, ...testData } };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: {
          get: () => 'application/json',
        },
      } as Response);

      const result = await apiClient.post('/test', testData);
      
      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(testData),
        })
      );
    });
  });

  describe('Authorization', () => {
    test('should include authorization header when token is set', async () => {
      const token = 'test-token';
      apiClient.setToken(token);
      
      const mockResponse = { success: true, data: {} };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: {
          get: () => 'application/json',
        },
      } as Response);

      await apiClient.get('/test');
      
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`,
          }),
        })
      );
    });
  });
});