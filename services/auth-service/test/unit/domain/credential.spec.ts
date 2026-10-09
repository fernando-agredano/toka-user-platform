import { Credential } from '../../../src/domain/entities/credential';
import { Email } from '../../../src/domain/value-objects/email';

const build = () => Credential.create({ id: 'user-1', email: Email.create('ana@toka.mx'), passwordHash: 'hash' });

describe('Credential', () => {
  it('starts active', () => {
    expect(build().isActive).toBe(true);
  });

  it('can be deactivated and reactivated', () => {
    const credential = build();
    credential.deactivate();
    expect(credential.isActive).toBe(false);
    credential.activate();
    expect(credential.isActive).toBe(true);
  });

  it('restores persisted state without altering it', () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const restored = Credential.restore({
      id: 'user-2',
      email: Email.create('b@toka.mx'),
      passwordHash: 'h',
      active: false,
      createdAt,
    });
    expect(restored).toMatchObject({ id: 'user-2', isActive: false, passwordHash: 'h', createdAt });
  });
});
