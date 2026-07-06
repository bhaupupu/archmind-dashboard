import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '../auth';
import { buildGitHubGraph } from '../../../../lib/github-graph';
import prisma from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { makeRateLimiter, checkRateLimit } from '@/lib/ratelimit';

export const maxDuration = 300;

const ratelimit = makeRateLimiter(10, '10 s');

export async function GET(req: NextRequest) {
  const id = requireRole(req, ['viewer', 'member', 'admin']);
  if (id instanceof NextResponse) return id;

  const limit = await checkRateLimit(ratelimit, id.tenantId);
  if (!limit.ok) {
    return NextResponse.json({ error: 'rate_limit_exceeded' }, { status: 429 });
  }

  const user = await prisma.user.findUnique({ where: { id: id.tenantId } });
  if (!user || !user.githubToken) {
    return NextResponse.json({ error: 'github_token_missing' }, { status: 400 });
  }

  const githubToken = decrypt(user.githubToken);

  const analysisId = req.nextUrl.searchParams.get('analysisId');
  const focalNode = req.nextUrl.searchParams.get('focalNode');

  // Join the most recent (or explicitly requested) analysis's per-repo disposition
  // onto the graph so node impactSeverity reflects a real analysis, not a stub.
  const analysis = analysisId
    ? await prisma.analysis.findFirst({ where: { id: analysisId, userId: id.tenantId } })
    : await prisma.analysis.findFirst({ where: { userId: id.tenantId }, orderBy: { createdAt: 'desc' } });

  const dispositionByRepo = new Map<string, string>();
  if (analysis) {
    try {
      const parsed = JSON.parse(analysis.result) as { affectedRepos?: { repoId: string; disposition: string }[] };
      for (const f of parsed.affectedRepos ?? []) {
        dispositionByRepo.set(f.repoId, f.disposition);
      }
    } catch {
      // Malformed stored result — fall back to 'no_change' below rather than failing the whole graph.
    }
  }

  try {
    const { graph } = await buildGitHubGraph(githubToken, id.tenantId);

    const hopDistance = new Map<string, number>();
    if (focalNode && graph.getNode(focalNode)) {
      let queue = [focalNode];
      let distance = 0;
      hopDistance.set(focalNode, 0);
      while (queue.length > 0) {
        const nextQueue: string[] = [];
        distance++;
        for (const cur of queue) {
          const neighbors = [
            ...graph.outgoing(cur).map(e => e.dstId),
            ...graph.incoming(cur).map(e => e.srcId)
          ];
          for (const n of neighbors) {
            if (!hopDistance.has(n)) {
              hopDistance.set(n, distance);
              nextQueue.push(n);
            }
          }
        }
        queue = nextQueue;
      }
    }

    const nodes = graph.allNodes().map((n) => ({
      id: n.id,
      type: 'customNode',
      data: {
        label: n.name,
        type: n.type,
        tenantId: n.tenantId,
        impactSeverity: dispositionByRepo.get(n.name) ?? 'no_change',
        hopDistance: hopDistance.has(n.id) ? hopDistance.get(n.id) : null,
        ...n.props
      }
    }));

    const edges = graph.allEdges().map((e) => ({
      id: `${e.srcId}->${e.dstId}`,
      source: e.srcId,
      target: e.dstId,
      data: {
        type: e.type,
        mechanism: e.mechanism,
        confidence: e.confidence,
        evidenceCount: e.evidence.length
      }
    }));

    return NextResponse.json({ nodes, edges });
  } catch (err) {
    console.error('Graph build failed', err);
    return NextResponse.json({ error: 'github_api_error' }, { status: 500 });
  }
}
