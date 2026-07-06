import { NextRequest, NextResponse } from 'next/server';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-do-not-use-in-prod';

export interface Identity {
  tenantId: string;
  userId: string;
  role: string;
  githubToken?: string;
}

export function getIdentity(req: NextRequest): Identity {
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      return {
        tenantId: decoded.sub,
        userId: decoded.user_id || '11111111-1111-1111-1111-111111111111',
        role: decoded.role || 'viewer',
        githubToken: decoded.gh_token
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
          userId: decoded.user_id || '11111111-1111-1111-1111-111111111111',
          role: decoded.role || 'viewer',
          githubToken: decoded.gh_token
        };
      } catch {}
    }
  }

  // Fallback for local testing if no auth is present
  return {
    tenantId: '00000000-0000-0000-0000-000000000000',
    userId: '11111111-1111-1111-1111-111111111111',
    role: 'admin'
  };
}

export function requireRole(req: NextRequest, allowedRoles: string[]): Identity | NextResponse {
  const id = getIdentity(req);
  if (!allowedRoles.includes(id.role)) {
    return NextResponse.json({ error: 'forbidden', required: allowedRoles, actual: id.role }, { status: 403 });
  }
  return id;
}
