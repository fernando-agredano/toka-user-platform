import { STATUS_CODES } from 'node:http';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CORRELATION_HEADER, getCorrelationId } from '../correlation/correlation-context';

/**
 * Domain errors are plain classes (the domain layer cannot import Nest), so the
 * filter recognises them by shape instead of by `instanceof`.
 */
export type DomainErrorKind =
  | 'validation'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'too_many_requests'
  | 'unavailable';

export interface DomainErrorLike extends Error {
  code: string;
  kind: DomainErrorKind;
}

const STATUS_BY_KIND: Record<DomainErrorKind, number> = {
  validation: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  too_many_requests: 429,
  unavailable: 503,
};

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  correlationId: string | null;
  errors?: string[];
}

const isDomainErrorLike = (error: unknown): error is DomainErrorLike =>
  error instanceof Error &&
  typeof (error as Partial<DomainErrorLike>).code === 'string' &&
  (error as Partial<DomainErrorLike>).kind !== undefined &&
  (error as Partial<DomainErrorLike>).kind! in STATUS_BY_KIND;

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-');

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const problem = this.toProblem(exception, request);
    if (problem.status >= 500) {
      // Stack traces go to the logs only, never to the response body.
      this.logger.error(
        `${request.method} ${request.path} -> ${problem.status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(problem.status).type('application/problem+json').json(problem);
  }

  private toProblem(exception: unknown, request: Request): ProblemDetails {
    const correlationId = getCorrelationId() ?? request.header(CORRELATION_HEADER) ?? null;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message = typeof body === 'string' ? body : (body as { message?: string | string[] }).message;
      const errors = Array.isArray(message) ? message : undefined;
      return {
        type: `urn:toka:problem:${slugify(STATUS_CODES[status] ?? 'error')}`,
        title: STATUS_CODES[status] ?? 'Error',
        status,
        detail: errors ? 'Request validation failed' : ((message as string | undefined) ?? exception.message),
        correlationId,
        ...(errors && { errors }),
      };
    }

    if (isDomainErrorLike(exception)) {
      const status = STATUS_BY_KIND[exception.kind];
      return {
        type: `urn:toka:problem:${exception.code}`,
        title: STATUS_CODES[status] ?? 'Error',
        status,
        detail: exception.message,
        correlationId,
      };
    }

    return {
      type: 'urn:toka:problem:internal-server-error',
      title: STATUS_CODES[500] ?? 'Internal Server Error',
      status: 500,
      detail: 'An unexpected error occurred',
      correlationId,
    };
  }
}
