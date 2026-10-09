import { InvalidEmailError, InvalidPasswordError } from '../../../src/domain/errors/domain-error';
import { Email } from '../../../src/domain/value-objects/email';
import { Password } from '../../../src/domain/value-objects/password';

describe('Email', () => {
  it('normalizes case and surrounding whitespace', () => {
    expect(Email.create('  Ana.Lopez@Toka.MX ').value).toBe('ana.lopez@toka.mx');
  });

  it.each(['', 'plainaddress', 'no@tld', 'two@@toka.mx', 'with space@toka.mx'])('rejects %p', (raw) => {
    expect(() => Email.create(raw)).toThrow(InvalidEmailError);
  });

  it('rejects addresses longer than 254 characters', () => {
    expect(() => Email.create(`${'a'.repeat(250)}@toka.mx`)).toThrow(InvalidEmailError);
  });

  it('compares by normalized value', () => {
    expect(Email.create('A@toka.mx').equals(Email.create('a@TOKA.mx'))).toBe(true);
  });
});

describe('Password', () => {
  it('accepts a password meeting every rule', () => {
    expect(Password.create('Str0ng!Pass').value).toBe('Str0ng!Pass');
  });

  it.each([
    ['too short', 'Ab1!'],
    ['no lowercase', 'ABCDEFG1!'],
    ['no uppercase', 'abcdefg1!'],
    ['no number', 'Abcdefgh!'],
    ['no symbol', 'Abcdefg12'],
  ])('rejects a password with %s', (_label, raw) => {
    expect(() => Password.create(raw)).toThrow(InvalidPasswordError);
  });

  it('lists every missing requirement in the message', () => {
    expect(() => Password.create('abcdefgh')).toThrow(/uppercase letter, a number, a symbol/);
  });

  it('rejects passwords over 128 characters', () => {
    expect(() => Password.create(`Aa1!${'x'.repeat(130)}`)).toThrow(InvalidPasswordError);
  });
});
