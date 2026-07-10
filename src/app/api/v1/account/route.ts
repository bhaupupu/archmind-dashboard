import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '../auth';
import prisma from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { getEnv } from '@/lib/env';

export async function GET(req: NextRequest) {
  const id = requireRole(req, ['viewer', 'member', 'admin']);
  if (id instanceof NextResponse) return id;

  const user = await prisma.user.findUnique({ where: { id: id.tenantId } });
  if (!user) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json({ username: user.username, createdAt: user.createdAt });
}

export async function DELETE(req: NextRequest) {
  const id = requireRole(req, ['viewer', 'member', 'admin']);
  if (id instanceof NextResponse) return id;

  const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } = getEnv();
  const user = await prisma.user.findUnique({ where: { id: id.tenantId } });

  // Best-effort: revoke the GitHub OAuth grant so Archmind's access disappears from
  // the user's GitHub settings too, not just from our own database.
  if (user?.githubToken) {
    try {
      const accessToken = decrypt(user.githubToken);
      await fetch(`https://api.github.com/applications/${GITHUB_CLIENT_ID}/token`, {
        method: 'DELETE',
        headers: {
          Authorization: `Basic ${Buffer.from(`${GITHUB_CLIENT_ID}:${GITHUB_CLIENT_SECRET}`).toString('base64')}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ access_token: accessToken }),
      });
    } catch (err) {
      console.error('Failed to revoke GitHub token during account deletion (continuing with local delete)', err);
    }
  }

  // Cascades to Repository, Analysis, and PullRequest rows via onDelete: Cascade.
  // A failed delete must NOT report success: the user would be logged out
  // believing their data (including the encrypted GitHub token) was erased.
  try {
    await prisma.user.delete({ where: { id: id.tenantId } });
  } catch (err) {
    console.error('[account] deletion failed', err);
    return NextResponse.json(
      { error: 'deletion_failed', message: 'Your account could not be deleted. Please try again.' },
      { status: 500 }
    );
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set('atlas_session', '', { path: '/', maxAge: 0 });
  return res;
}
