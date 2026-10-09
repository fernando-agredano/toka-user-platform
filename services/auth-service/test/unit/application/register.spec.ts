import { CreateCredentialInternalUseCase } from '../../../src/application/use-cases/create-credential-internal.use-case';
import { RegisterUseCase } from '../../../src/application/use-cases/register.use-case';
import {
  EmailAlreadyRegisteredError,
  InvalidEmailError,
  InvalidPasswordError,
} from '../../../src/domain/errors/domain-error';
import { FakePasswordHasher, InMemoryCredentialRepository } from '../support/fakes';

const input = { email: 'Ana@Toka.mx', password: 'Str0ng!Pass', firstName: ' Ana ', lastName: 'López' };

describe('RegisterUseCase', () => {
  let repository: InMemoryCredentialRepository;
  let register: RegisterUseCase;

  beforeEach(() => {
    repository = new InMemoryCredentialRepository();
    register = new RegisterUseCase(repository, new FakePasswordHasher());
  });

  it('stores a hashed credential and emits auth.user.registered with the profile data', async () => {
    const { userId } = await register.execute(input);

    const stored = repository.items.get(userId)!;
    expect(stored.email.value).toBe('ana@toka.mx');
    expect(stored.passwordHash).toBe('hashed:Str0ng!Pass');
    expect(repository.savedEvents).toEqual([
      expect.objectContaining({
        type: 'auth.user.registered',
        data: { userId, email: 'ana@toka.mx', firstName: 'Ana', lastName: 'López' },
      }),
    ]);
  });

  it('rejects a duplicate email regardless of case', async () => {
    await register.execute(input);
    await expect(register.execute({ ...input, email: 'ANA@toka.mx' })).rejects.toThrow(EmailAlreadyRegisteredError);
    expect(repository.items.size).toBe(1);
  });

  it('rejects invalid email and weak password without persisting anything', async () => {
    await expect(register.execute({ ...input, email: 'nope' })).rejects.toThrow(InvalidEmailError);
    await expect(register.execute({ ...input, password: 'weak' })).rejects.toThrow(InvalidPasswordError);
    expect(repository.items.size).toBe(0);
  });
});

describe('CreateCredentialInternalUseCase', () => {
  it('keeps the user id supplied by the caller', async () => {
    const repository = new InMemoryCredentialRepository();
    const useCase = new CreateCredentialInternalUseCase(new RegisterUseCase(repository, new FakePasswordHasher()));

    const result = await useCase.execute({ ...input, userId: 'fixed-id' });

    expect(result).toEqual({ userId: 'fixed-id' });
    expect(repository.items.has('fixed-id')).toBe(true);
  });
});
