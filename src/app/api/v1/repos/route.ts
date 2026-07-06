import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '../auth';
import { buildGitHubGraph } from '../../../../lib/github-graph';

export async function GET(req: NextRequest) {
  const id = requireRole(req, ['viewer', 'member', 'admin']);
  if (id instanceof NextResponse) return id; // Auth failed

  if (!id.githubToken) {
    return NextResponse.json({ error: 'github_token_missing' }, { status: 400 });
  }

  try {
    const { repos } = await buildGitHubGraph(id.githubToken, id.tenantId);
    return NextResponse.json({ repos });
  } catch (err) {
    console.error('Failed to list repos via GitHub', err);
    return NextResponse.json({ error: 'github_api_error' }, { status: 500 });
  }
}
