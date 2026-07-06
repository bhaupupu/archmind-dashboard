import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', database: 'up' });
  } catch (err) {
    console.error('[health] database check failed', err);
    return NextResponse.json({ status: 'degraded', database: 'down' }, { status: 503 });
  }
}
