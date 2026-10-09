import { Injectable } from '@nestjs/common';
import { RegisterInput, RegisterUseCase } from './register.use-case';

/**
 * Credential creation requested by user-service (admin-created users).
 * Same rules as public registration, but the caller supplies the user id.
 */
@Injectable()
export class CreateCredentialInternalUseCase {
  constructor(private readonly register: RegisterUseCase) {}

  execute(input: RegisterInput & { userId: string }): Promise<{ userId: string }> {
    return this.register.execute(input);
  }
}
