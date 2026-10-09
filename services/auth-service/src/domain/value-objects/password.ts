import { InvalidPasswordError } from '../errors/domain-error';

const MIN_LENGTH = 8;
// argon2 has no input limit, but an upper bound prevents hashing-based DoS.
const MAX_LENGTH = 128;

const RULES: ReadonlyArray<[RegExp, string]> = [
  [/[a-z]/, 'a lowercase letter'],
  [/[A-Z]/, 'an uppercase letter'],
  [/\d/, 'a number'],
  [/[^A-Za-z0-9]/, 'a symbol'],
];

/** A plain-text password that satisfies the policy. It is never persisted, only hashed. */
export class Password {
  private constructor(readonly value: string) {}

  static create(raw: string): Password {
    if (raw.length < MIN_LENGTH || raw.length > MAX_LENGTH) {
      throw new InvalidPasswordError(`Password must be between ${MIN_LENGTH} and ${MAX_LENGTH} characters`);
    }
    const missing = RULES.filter(([pattern]) => !pattern.test(raw)).map(([, label]) => label);
    if (missing.length > 0) throw new InvalidPasswordError(`Password must contain ${missing.join(', ')}`);
    return new Password(raw);
  }
}
