import type { UserAuthorization } from '../dtos/role.dtos';

export const PERMISSIONS_CACHE = Symbol('PERMISSIONS_CACHE');
export interface PermissionsCache {
  get(userId: string): Promise<UserAuthorization | null>;
  set(userId: string, authorization: UserAuthorization): Promise<void>;
  invalidate(userIds: string[]): Promise<void>;
}
