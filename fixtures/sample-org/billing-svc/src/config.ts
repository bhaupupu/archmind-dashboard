// @acme/billing-svc configuration read from the environment.
// Shares JWT_SECRET with auth-lib — an implicit cross-repo config coupling.
export const JWT_SECRET = process.env.JWT_SECRET ?? '';
export const STRIPE_KEY = process.env.STRIPE_KEY ?? '';
