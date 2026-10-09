import type { UserView } from '../dtos/user.dtos';

export const USER_CACHE = Symbol('USER_CACHE');
export interface UserCache {
  get(userId: string): Promise<UserView | null>;
  set(user: UserView): Promise<void>;
  invalidate(userId: string): Promise<void>;
}

export const CREDENTIAL_GATEWAY = Symbol('CREDENTIAL_GATEWAY');
export interface NewCredential {
  userId: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}
export interface CredentialGateway {
  /** Creates the login credentials in auth-service. Throws EmailAlreadyExistsError, CredentialsRejectedError or AuthServiceUnavailableError. */
  create(credential: NewCredential): Promise<void>;
}
