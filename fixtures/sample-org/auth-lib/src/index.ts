// @acme/auth-lib — the shared auth primitive the rest of the org depends on.
export interface Principal {
  userId: string;
  orgId: string;
  scopes: string[];
}

export function verifyToken(token: string): Principal {
  // (fixture) pretend to verify and decode
  const [userId, orgId] = token.split(':');
  return { userId: userId ?? 'anon', orgId: orgId ?? 'none', scopes: [] };
}

export function hasScope(principal: Principal, scope: string): boolean {
  return principal.scopes.includes(scope);
}
