import { NextRequest, NextResponse } from 'next/server';
import * as jwt from 'jsonwebtoken';
import { getEnv } from '@/lib/env';


export interface Identity {
  tenantId: string;
  userId: string;
  role: string;
}

export function getIdentity(req: NextRequest): Identity | null {
  const { JWT_SECRET } = getEnv();
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      return {
        tenantId: decoded.sub,
        userId: decoded.user_id || decoded.sub,
        role: decoded.role || 'viewer'
      };
    } catch {}
  }

  const cookieHeader = req.headers.get('cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(/atlas_session=([^;]+)/);
    if (match) {
      try {
        const decoded = jwt.verify(match[1]!, JWT_SECRET) as any;
        return {
          tenantId: decoded.sub,
          userId: decoded.user_id || decoded.sub,
          role: decoded.role || 'viewer'
        };
      } catch {}
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
