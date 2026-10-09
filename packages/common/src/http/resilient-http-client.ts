import axios, { AxiosInstance, AxiosRequestConfig, isAxiosError } from 'axios';
import CircuitBreaker from 'opossum';
import { CORRELATION_HEADER, getCorrelationId } from '../correlation/correlation-context';

export interface ResilientHttpClientOptions {
  name: string;
  baseURL: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  retries?: number;
  retryBaseDelayMs?: number;
  breaker?: { resetTimeoutMs?: number; errorThresholdPercentage?: number; volumeThreshold?: number };
}

export interface RequestOptions {
  /** Forwarded as the `Authorization` header (the caller's JWT). */
  authorization?: string;
  /** Allows retries. Defaults to true for GET/HEAD only. */
  idempotent?: boolean;
}

const IDEMPOTENT_BY_DEFAULT = new Set(['GET', 'HEAD']);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const isCircuitOpenError = (error: unknown): boolean =>
  error instanceof Error && (error as { code?: string }).code === 'EOPENBREAKER';

/** 4xx responses mean the dependency is healthy, so they must not trip the breaker or be retried. */
const isClientError = (error: unknown): boolean =>
  isAxiosError(error) && error.response !== undefined && error.response.status < 500;

export class ResilientHttpClient {
  private readonly axios: AxiosInstance;
  private readonly breaker: CircuitBreaker<[AxiosRequestConfig], unknown>;
  private readonly retries: number;
  private readonly retryBaseDelayMs: number;

  constructor(options: ResilientHttpClientOptions) {
    const timeout = options.timeoutMs ?? 2000;
    this.axios = axios.create({ baseURL: options.baseURL, timeout, headers: options.headers });
    this.retries = options.retries ?? 2;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 100;
    this.breaker = new CircuitBreaker((config: AxiosRequestConfig) => this.axios.request(config), {
      name: options.name,
      timeout: timeout + 500,
      resetTimeout: options.breaker?.resetTimeoutMs ?? 10_000,
      errorThresholdPercentage: options.breaker?.errorThresholdPercentage ?? 50,
      volumeThreshold: options.breaker?.volumeThreshold ?? 5,
      errorFilter: isClientError,
    });
  }

  async get<T>(url: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>({ method: 'GET', url }, options);
  }

  async request<T>(config: AxiosRequestConfig, options: RequestOptions = {}): Promise<T> {
    const method = (config.method ?? 'GET').toUpperCase();
    const canRetry = options.idempotent ?? IDEMPOTENT_BY_DEFAULT.has(method);
    const correlationId = getCorrelationId();
    const finalConfig: AxiosRequestConfig = {
      ...config,
      headers: {
        ...config.headers,
        ...(correlationId && { [CORRELATION_HEADER]: correlationId }),
        ...(options.authorization && { Authorization: options.authorization }),
      },
    };

    for (let attempt = 0; ; attempt++) {
      try {
        const response = (await this.breaker.fire(finalConfig)) as { data: T };
        return response.data;
      } catch (error) {
        const exhausted = attempt >= this.retries;
        if (!canRetry || exhausted || isClientError(error) || isCircuitOpenError(error)) throw error;
        await sleep(this.retryBaseDelayMs * 2 ** attempt);
      }
    }
  }

  shutdown(): void {
    this.breaker.shutdown();
  }
}
