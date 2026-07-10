"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GitPullRequest, CheckSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface PullRequestDraft {
  id: string;
  repoId: string;
  title: string;
  body: string;
  checklist: string[];
  status: string;
  createdAt: string;
}

export default function PullRequestsPage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<PullRequestDraft[] | null>(null);

  useEffect(() => {
    fetch('/api/v1/pull-requests')
      .then((res) => (res.status === 401 ? router.push('/login') : res.json()))
      .then((data) => data && setDrafts(data.pullRequests))
      .catch(console.error);
  }, [router]);

  return (
    <div className="flex flex-col gap-4 p-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pull Requests</h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI-drafted PR titles, descriptions, and checklists generated from your impact analyses.
          Drafts only — nothing is pushed to GitHub automatically.
        </p>
      </div>

      {drafts === null && (
        <div className="text-sm text-muted-foreground italic py-12 text-center">Loading…</div>
      )}

      {drafts?.length === 0 && (
        <div className="bg-surface rounded-xl border border-white/5 p-12 flex flex-col items-center text-center gap-3">
          <GitPullRequest className="w-8 h-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground max-w-sm">
            No PR drafts yet. Run an analysis, then click &quot;Generate PR draft&quot; on any affected
            repository.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {drafts?.map((pr) => (
          <div key={pr.id} className="bg-surface rounded-xl border border-white/5 p-5 flex flex-col gap-3">
            <div className="flex justify-between items-start gap-4">
              <div>
                <span className="text-xs font-mono text-blue-400">{pr.repoId}</span>
                <h2 className="font-semibold text-white">{pr.title}</h2>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground text-[10px] font-medium border border-white/10 uppercase">
                  {pr.status}
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(pr.createdAt), { addSuffix: true })}
                </span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-black/20 rounded-lg p-3 border border-white/5">
              {pr.body}
            </p>

            {pr.checklist?.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {pr.checklist.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckSquare className="w-3.5 h-3.5 shrink-0" /> {item}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
