import { User } from '../../../src/domain/entities/user';
import { InvalidEmailError, InvalidNameError } from '../../../src/domain/errors/domain-error';
import { Email } from '../../../src/domain/value-objects/email';
import { PersonName } from '../../../src/domain/value-objects/person-name';
import { buildUser } from '../support/fakes';

describe('Email', () => {
  it('normalizes case and whitespace', () => {
    expect(Email.create('  Ana@Toka.MX ').value).toBe('ana@toka.mx');
  });

  it.each(['', 'nope', 'a@b', `${'a'.repeat(250)}@toka.mx`])('rejects %p', (raw) => {
    expect(() => Email.create(raw)).toThrow(InvalidEmailError);
  });
});

describe('PersonName', () => {
  it('trims the value', () => {
    expect(PersonName.create('  Ana ', 'firstName').value).toBe('Ana');
  });

  it('rejects empty and overly long names, naming the field', () => {
    expect(() => PersonName.create('   ', 'firstName')).toThrow(/firstName must not be empty/);
    expect(() => PersonName.create('x'.repeat(101), 'lastName')).toThrow(InvalidNameError);
  });
});

describe('User', () => {
  it('starts ACTIVE', () => {
    const user = buildUser();
    expect(user.status).toBe('ACTIVE');
    expect(user.isActive).toBe(true);
  });

  it('deactivates and reactivates, reporting whether the state changed', () => {
    const user = buildUser();
    expect(user.deactivate()).toBe(true);
    expect(user.isActive).toBe(false);
    expect(user.deactivate()).toBe(false);
    expect(user.activate()).toBe(true);
    expect(user.activate()).toBe(false);
  });

  it('updates the profile only when a name actually changes', () => {
    const user = buildUser();
    expect(user.updateProfile({ firstName: PersonName.create('Ana', 'firstName') })).toBe(false);
    expect(user.updateProfile({})).toBe(false);
    expect(user.updateProfile({ lastName: PersonName.create('Pérez', 'lastName') })).toBe(true);
    expect(user.lastName.value).toBe('Pérez');
    expect(user.firstName.value).toBe('Ana');
  });

  it('restores from persisted props without altering them', () => {
    const original = buildUser();
    const restored = User.restore({
      id: original.id,
      email: original.email,
      firstName: original.firstName,
      lastName: original.lastName,
      status: 'INACTIVE',
      createdAt: original.createdAt,
      updatedAt: original.updatedAt,
    });
    expect(restored.status).toBe('INACTIVE');
    expect(restored.createdAt).toBe(original.createdAt);
  });
});
