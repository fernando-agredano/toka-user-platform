import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { CORRELATION_HEADER, correlationStorage } from './correlation-context';

const SAFE_CORRELATION_ID = /^[\w.-]{1,128}$/;

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header(CORRELATION_HEADER);
    // Reject unexpected formats so a client cannot inject arbitrary content into our logs.
    const correlationId = incoming && SAFE_CORRELATION_ID.test(incoming) ? incoming : randomUUID();
    req.headers[CORRELATION_HEADER] = correlationId;
    res.setHeader(CORRELATION_HEADER, correlationId);
    correlationStorage.run({ correlationId }, next);
  }
}
