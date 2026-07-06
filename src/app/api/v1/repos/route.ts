import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '../auth';
import prisma from '../../../../lib/db';

export async function GET(req: NextRequest) {
  const id = requireRole(req, ['viewer', 'member', 'admin']);
  if (id instanceof NextResponse) return id;

  try {
    const repos = await prisma.repository.findMany({
      where: { userId: id.tenantId },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json({ repos });
  } catch (err) {
    console.error('Failed to list repos from database', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
