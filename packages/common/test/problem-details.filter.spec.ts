import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ProblemDetailsFilter } from '../src/errors/problem-details.filter';

class FakeDomainError extends Error {
  readonly code = 'email-already-registered';
  readonly kind = 'conflict';
}

const handle = (exception: unknown) => {
  const json = jest.fn();
  const response = { status: jest.fn().mockReturnThis(), type: jest.fn().mockReturnThis(), json };
  const request = { method: 'POST', path: '/x', header: () => 'corr-1' };
  const host = { switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }) };
  new ProblemDetailsFilter().catch(exception, host as never);
  return { status: response.status.mock.calls[0][0] as number, body: json.mock.calls[0][0] };
};

describe('ProblemDetailsFilter', () => {
  it('maps class-validator failures to 400 with the list of errors', () => {
    const { status, body } = handle(new BadRequestException(['email must be an email', 'password should not be empty']));
    expect(status).toBe(400);
    expect(body).toMatchObject({
      title: 'Bad Request',
      detail: 'Request validation failed',
      errors: ['email must be an email', 'password should not be empty'],
      correlationId: 'corr-1',
    });
  });

  it('maps other HttpExceptions keeping their message', () => {
    const { status, body } = handle(new ForbiddenException('Insufficient permissions'));
    expect(status).toBe(403);
    expect(body.detail).toBe('Insufficient permissions');
  });

  it('maps domain errors by kind', () => {
    const { status, body } = handle(new FakeDomainError('Email is already registered'));
    expect(status).toBe(409);
    expect(body).toMatchObject({ type: 'urn:toka:problem:email-already-registered', detail: 'Email is already registered' });
  });

  it('hides internals of unexpected errors', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { status, body } = handle(new Error('connect ECONNREFUSED 10.0.0.5:5432'));
    expect(status).toBe(500);
    expect(JSON.stringify(body)).not.toContain('ECONNREFUSED');
    expect(body.detail).toBe('An unexpected error occurred');
  });
});
