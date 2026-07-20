/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures by failing fast when external services are unhealthy
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold: number; // Number of failures before opening circuit
  successThreshold: number; // Number of successes in half-open before closing
  timeout: number; // Time in ms before attempting reset (open -> half-open)
  name: string; // Circuit breaker name for logging
}

export class CircuitBreakerError extends Error {
  constructor(serviceName: string) {
    super(`Circuit breaker OPEN for service: ${serviceName}`);
    this.name = 'CircuitBreakerError';
  }
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private readonly options: CircuitBreakerOptions;

  constructor(options: CircuitBreakerOptions) {
    this.options = options;
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      // Check if timeout has passed to transition to HALF_OPEN
      if (this.lastFailureTime && Date.now() - this.lastFailureTime > this.options.timeout) {
        console.log(`⚡ Circuit breaker [${this.options.name}] transitioning to HALF_OPEN`);
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      } else {
        console.warn(`⚡ Circuit breaker [${this.options.name}] is OPEN - failing fast`);
        throw new CircuitBreakerError(this.options.name);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.options.successThreshold) {
        console.log(`✅ Circuit breaker [${this.options.name}] CLOSED - service recovered`);
        this.state = 'CLOSED';
        this.successCount = 0;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      console.warn(`⚠️  Circuit breaker [${this.options.name}] failed in HALF_OPEN - reopening`);
      this.state = 'OPEN';
    } else if (this.failureCount >= this.options.failureThreshold) {
      console.error(`🚨 Circuit breaker [${this.options.name}] OPEN - threshold reached (${this.failureCount} failures)`);
      this.state = 'OPEN';
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  reset(): void {
    console.log(`🔄 Circuit breaker [${this.options.name}] manually reset`);
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
  }
}

/**
 * Circuit Breaker Registry for managing multiple service breakers
 */
class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Get or create a circuit breaker for a service
   */
  get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  /**
   * Create and register a new circuit breaker
   */
  create(name: string, options: Omit<CircuitBreakerOptions, 'name'>): CircuitBreaker {
    const breaker = new CircuitBreaker({ ...options, name });
    this.breakers.set(name, breaker);
    return breaker;
  }

  /**
   * Get stats for all circuit breakers
   */
  getAllStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    for (const [name, breaker] of this.breakers.entries()) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}

// Default circuit breaker configurations for common services
export const defaultCircuitBreakerConfig = {
  firebase: {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30000, // 30 seconds
  },
  sms: {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 60000, // 1 minute
  },
  payment: {
    failureThreshold: 3,
    successThreshold: 1,
    timeout: 30000, // 30 seconds
  },
  email: {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60000, // 1 minute
  },
  database: {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 10000, // 10 seconds
  },
  redis: {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 10000, // 10 seconds
  },
};

// Global registry instance
export const circuitBreakerRegistry = new CircuitBreakerRegistry();

/**
 * Get or create circuit breaker for a service with default config
 */
export const getCircuitBreaker = (serviceName: keyof typeof defaultCircuitBreakerConfig): CircuitBreaker => {
  let breaker = circuitBreakerRegistry.get(serviceName);
  
  if (!breaker) {
    const config = defaultCircuitBreakerConfig[serviceName];
    breaker = circuitBreakerRegistry.create(serviceName, config);
  }
  
  return breaker;
};

/**
 * Execute external service call with circuit breaker protection
 */
export const withCircuitBreaker = async <T>(
  serviceName: keyof typeof defaultCircuitBreakerConfig,
  fn: () => Promise<T>
): Promise<T> => {
  const breaker = getCircuitBreaker(serviceName);
  return breaker.execute(fn);
};

export default CircuitBreaker;
