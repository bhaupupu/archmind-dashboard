// @acme/billing-svc — also depends on @acme/auth-lib (internal).
import { verifyToken, hasScope } from '@acme/auth-lib';

export function charge(token: string, amountCents: number): { charged: boolean } {
  const principal = verifyToken(token);
  if (!hasScope(principal, 'billing:write')) return { charged: false };
  return { charged: amountCents > 0 };
}
