import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '../../auth';
import prisma from '../../../../../lib/db';

export async function GET(req: NextRequest) {
  const id = requireRole(req, ['viewer', 'member', 'admin']);
  if (id instanceof NextResponse) return id;

  try {
    const history = await prisma.analysis.findMany({
      where: { userId: id.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const formattedHistory = history.map((item) => ({
      id: item.id,
      prompt: item.prompt,
      createdAt: item.createdAt,
      result: JSON.parse(item.result),
    }));

    return NextResponse.json({ history: formattedHistory });
  } catch (error) {
    console.error('Error fetching analysis history:', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
