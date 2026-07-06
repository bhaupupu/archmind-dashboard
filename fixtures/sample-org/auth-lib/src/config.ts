// @acme/auth-lib runtime configuration read from the environment.
export const JWT_SECRET = process.env.JWT_SECRET ?? '';
export const JWT_ISSUER = process.env.JWT_ISSUER ?? 'acme';
