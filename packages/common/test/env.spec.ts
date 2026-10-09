import { intEnv, optionalEnv, requireEnv } from '../src/config/env';

describe('env helpers', () => {
  it('requireEnv returns the value or throws when it is missing or empty', () => {
    expect(requireEnv('A', { A: 'x' })).toBe('x');
    expect(() => requireEnv('A', {})).toThrow('Missing required environment variable: A');
    expect(() => requireEnv('A', { A: '' })).toThrow('Missing required environment variable: A');
  });

  it('optionalEnv falls back when the variable is unset or empty', () => {
    expect(optionalEnv('A', 'fallback', { A: 'x' })).toBe('x');
    expect(optionalEnv('A', 'fallback', {})).toBe('fallback');
    expect(optionalEnv('A', 'fallback', { A: '' })).toBe('fallback');
  });

  it('intEnv parses integers, falls back when unset and rejects non-numeric values', () => {
    expect(intEnv('N', 1, { N: '8' })).toBe(8);
    expect(intEnv('N', 1, {})).toBe(1);
    expect(() => intEnv('N', 1, { N: 'eight' })).toThrow('Environment variable N must be an integer');
  });
});
