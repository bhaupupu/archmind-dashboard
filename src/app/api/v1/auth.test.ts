import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import * as jwt from 'jsonwebtoken';
import { getIdentity, requireRole, signSessionToken } from './auth';

const JWT_SECRET = 'test-jwt-secret-do-not-use-in-prod'; // must match vitest.config.ts test.env

function reqWithBearer(token: string) {
  return new NextRequest('http://localhost/api/v1/analyses', {
    headers: { authorization: `Bearer ${token}` },
  });
}

function reqWithCookie(token: string) {
  return new NextRequest('http://localhost/api/v1/analyses', {
    headers: { cookie: `atlas_session=${token}` },
  });
}

describe('getIdentity', () => {
  it('returns null when no Authorization header or cookie is present', () => {
    const req = new NextRequest('http://localhost/api/v1/analyses');
    expect(getIdentity(req)).toBeNull();
  });

  it('returns null for an invalid/tampered token instead of a default identity', () => {
    const req = reqWithBearer('this-is-not-a-valid-jwt');
    expect(getIdentity(req)).toBeNull();
  });

  it('returns null for a token signed with the wrong secret', () => {
    const token = jwt.sign({ sub: 'user-1', role: 'admin' }, 'wrong-secret');
    expect(getIdentity(reqWithBearer(token))).toBeNull();
  });

  it('returns null for an expired token', () => {
    const token = jwt.sign({ sub: 'user-1', role: 'admin' }, JWT_SECRET, { expiresIn: -10 });
    expect(getIdentity(reqWithBearer(token))).toBeNull();
  });

  it('decodes a valid Bearer token', () => {
    const token = jwt.sign({ sub: 'user-1', role: 'member' }, JWT_SECRET);
    const identity = getIdentity(reqWithBearer(token));
    expect(identity).toEqual({ tenantId: 'user-1', userId: 'user-1', role: 'member' });
  });

  it('decodes a valid session cookie', () => {
    const token = jwt.sign({ sub: 'user-2', role: 'viewer' }, JWT_SECRET);
    const identity = getIdentity(reqWithCookie(token));
    expect(identity).toEqual({ tenantId: 'user-2', userId: 'user-2', role: 'viewer' });
  });

  it('defaults role to viewer when the token omits it', () => {
    const token = jwt.sign({ sub: 'user-3' }, JWT_SECRET);
    expect(getIdentity(reqWithBearer(token))?.role).toBe('viewer');
  });
});

describe('signSessionToken', () => {
  // Regression: tokens were once issued without a role claim, so getIdentity
  // defaulted everyone to 'viewer' and all write routes (analyses POST,
  // pull-requests POST) returned 403 for every real user.
  it('issues a token that passes the write-route role check', () => {
    const token = signSessionToken({ sub: 'user-1', username: 'octocat' });
    const result = requireRole(reqWithCookie(token), ['member', 'admin']);
    expect(result).toEqual({ tenantId: 'user-1', userId: 'user-1', role: 'admin' });
  });

  it('issues a token that expires', () => {
    const token = signSessionToken({ sub: 'user-1', username: 'octocat' });
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    expect(decoded.exp).toBeDefined();
    expect(decoded.exp! * 1000).toBeGreaterThan(Date.now());
  });
});

describe('requireRole', () => {
  it('returns a 401 response when unauthenticated', () => {
    const req = new NextRequest('http://localhost/api/v1/analyses');
    const result = requireRole(req, ['admin']);
    expect(result).not.toHaveProperty('tenantId');
    // @ts-expect-error - NextResponse has a status property
    expect(result.status).toBe(401);
  });

  it('returns a 403 response when the role is not allowed', () => {
    const token = jwt.sign({ sub: 'user-1', role: 'viewer' }, JWT_SECRET);
    const result = requireRole(reqWithBearer(token), ['admin']);
    // @ts-expect-error - NextResponse has a status property
    expect(result.status).toBe(403);
  });

  it('returns the identity when the role is allowed', () => {
    const token = jwt.sign({ sub: 'user-1', role: 'admin' }, JWT_SECRET);
    const result = requireRole(reqWithBearer(token), ['admin', 'member']);
    expect(result).toEqual({ tenantId: 'user-1', userId: 'user-1', role: 'admin' });
  });
});
