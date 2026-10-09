/** Who is calling the MCP server, built once per request from the verified JWT. */
export interface Caller {
  userId: string;
  email: string;
  roles: string[];
  permissions: string[];
  /** The caller's own `Authorization` header: forwarded so every downstream service enforces their permissions. */
  authorization: string;
  ip: string | null;
  transport: 'http' | 'stdio';
  /** Token expiration, seconds since epoch. */
  expiresAt?: number;
}

export const hasPermissions = (caller: Caller, required: string[]): boolean =>
  required.every((permission) => caller.permissions.includes(permission));
