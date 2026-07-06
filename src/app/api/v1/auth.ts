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
