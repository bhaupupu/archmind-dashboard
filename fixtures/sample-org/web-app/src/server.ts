// @acme/web-app — depends on @acme/auth-lib (internal) and express (external).
import { verifyToken, hasScope } from '@acme/auth-lib';

export function handleRequest(authHeader: string): { ok: boolean; userId: string } {
  const principal = verifyToken(authHeader);
  const ok = hasScope(principal, 'web:read');
  return { ok, userId: principal.userId };
}
