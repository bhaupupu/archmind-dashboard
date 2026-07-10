import { NextRequest, NextResponse } from 'next/server';
import * as jwt from 'jsonwebtoken';
import { getEnv } from '@/lib/env';


export interface Identity {
  tenantId: string;
  userId: string;
  role: string;
}

// Session tokens are always HMAC-signed; pinning prevents algorithm-confusion
// tricks if key material ever changes shape.
const JWT_ALGORITHMS: jwt.Algorithm[] = ['HS256'];

function verifyToken(token: string, secret: string): Identity | null {
  try {
    const decoded = jwt.verify(token, secret, { algorithms: JWT_ALGORITHMS }) as jwt.JwtPayload;
    // A signed token without a subject is not a usable identity — reject it here
    // so downstream queries never run with `where: { id: undefined }`.
    if (typeof decoded.sub !== 'string' || decoded.sub.length === 0) return null;
    return {
      tenantId: decoded.sub,
      userId: decoded.user_id || decoded.sub,
      role: decoded.role || 'viewer'
    };
  } catch {
    return null;
  }
}

export function getIdentity(req: NextRequest): Identity | null {
  const { JWT_SECRET } = getEnv();
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const identity = verifyToken(authHeader.substring(7), JWT_SECRET);
    if (identity) return identity;
  }

  const cookieHeader = req.headers.get('cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(/atlas_session=([^;]+)/);
    if (match) {
      return verifyToken(match[1]!, JWT_SECRET);
    }
  }

  return null;
}

/**
 * Signs the session JWT issued at OAuth callback. Single-user tenancy: the
 * account owner has full rights over their own data, so the token must carry
 * role 'admin' — without it getIdentity defaults to 'viewer' and every write
 * route (analyses POST, pull-requests POST) returns 403.
 */
export function signSessionToken(payload: { sub: string; username: string }): string {
  const { JWT_SECRET } = getEnv();
  return jwt.sign({ ...payload, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
}

export function requireRole(req: NextRequest, allowedRoles: string[]): Identity | NextResponse {
  const id = getIdentity(req);
  if (!id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!allowedRoles.includes(id.role)) {
    return NextResponse.json({ error: 'forbidden', required: allowedRoles, actual: id.role }, { status: 403 });
  }
  return id;
}
