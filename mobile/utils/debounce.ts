import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * A custom hook that debounces a value by a specified delay
 * @param value The value to debounce
 * @param delay The delay in milliseconds
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Update debounced value after delay
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cancel the timeout if value changes (before the delay time ends)
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * A custom hook that returns a debounced callback function
 * @param callback The callback function to debounce
 * @param delay The delay in milliseconds
 * @param deps Dependencies for the callback
 * @returns The debounced callback function
 */
export function useDebouncedCallback(
  callback: (...args: any[]) => any,
  delay: number,
  deps: React.DependencyList
): (...args: any[]) => void {
  const timeoutRef = useRef<NodeJS.Timeout | number | null>(null);

  const debouncedCallback = useCallback((...args: any[]) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current as number);
    }

    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay, ...deps]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current as number);
      }
    };
  }, []);

  return debouncedCallback;
}