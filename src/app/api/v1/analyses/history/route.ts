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

    // One corrupt row must not take down the whole history endpoint — skip it.
    const formattedHistory = history.flatMap((item) => {
      try {
        return [{
          id: item.id,
          prompt: item.prompt,
          createdAt: item.createdAt,
          result: JSON.parse(item.result),
        }];
      } catch {
        console.error(`[analyses/history] skipping corrupt analysis row ${item.id}`);
        return [];
      }
    });

    return NextResponse.json({ history: formattedHistory });
  } catch (error) {
    console.error('Error fetching analysis history:', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
