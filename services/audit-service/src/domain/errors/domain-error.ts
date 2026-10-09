export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly kind: 'validation',
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidDateRangeError extends DomainError {
  constructor() {
    super('"from" must be earlier than or equal to "to"', 'INVALID_DATE_RANGE', 'validation');
  }
}
