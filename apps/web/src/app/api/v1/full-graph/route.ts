import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '../auth';
import { buildGitHubGraph } from '../../../../lib/github-graph';
// Note: We don't have DB integrations for analysis reports in this minimal setup yet.

export async function GET(req: NextRequest) {
  const id = requireRole(req, ['viewer', 'member', 'admin']);
  if (id instanceof NextResponse) return id;

  if (!id.githubToken) {
    return NextResponse.json({ error: 'github_token_missing' }, { status: 400 });
  }

  const analysisId = req.nextUrl.searchParams.get('analysisId');
  const focalNode = req.nextUrl.searchParams.get('focalNode');

  try {
    const { graph } = await buildGitHubGraph(id.githubToken, id.tenantId);

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
        impactSeverity: 'no_change', // Fallback until db is linked
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
