import { InvalidNameError } from '../errors/domain-error';

const MAX_LENGTH = 100;

export class PersonName {
  private constructor(readonly value: string) {}

  static create(raw: string, field: string): PersonName {
    const trimmed = raw.trim();
    if (trimmed.length === 0) throw new InvalidNameError(`${field} must not be empty`);
    if (trimmed.length > MAX_LENGTH) throw new InvalidNameError(`${field} must be at most ${MAX_LENGTH} characters`);
    return new PersonName(trimmed);
  }
}
