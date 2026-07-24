"use client";

import { DependencyGraph } from "@/components/graph/DependencyGraph";
import { Button } from "@/components/ui/button";
import { Settings, Plus, Box, HeartPulse, Sparkles, Bot, GitPullRequest, ShieldAlert, X } from "lucide-react";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PromptBox } from "@/components/dashboard/PromptBox";
import { StreamLog } from "@/components/dashboard/StreamLog";
import { ImpactCards } from "@/components/dashboard/ImpactCards";
import { RepoFilters } from "@/components/dashboard/RepoFilters";

export default function DashboardPage() {
  const router = useRouter();
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [repoCount, setRepoCount] = useState(0);
  const [analysisCount, setAnalysisCount] = useState(0);
  const [resultsSearch, setResultsSearch] = useState("");
  const [resultsFilter, setResultsFilter] = useState("all");
  const [username, setUsername] = useState<string>("");

  useEffect(() => {
    fetch('/api/v1/account')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.username) setUsername(data.username);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetch('/api/v1/full-graph')
      .then(res => {
        if (res.status === 401) {
          router.push('/login');
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (data && data.nodes) {
          if (data.nodes.length === 0) {
            router.push('/onboarding');
          } else {
            setRepoCount(data.nodes.length);
          }
        }
      });

    fetch('/api/v1/analyses/history')
      .then(res => res.json())
      .then(data => {
        if (data.history) {
          setAnalysisCount(data.history.length);
          if (data.history.length > 0) setReport(data.history[0].result);
        }
      })
      .catch(console.error);
  }, [router]);

  const handleAnalyze = async (prompt: string) => {
    setAnalyzing(true);
    try {
      const res = await fetch('/api/v1/analyses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const data = await res.json();
      setReport(data);
      setAnalysisCount((c) => c + 1);
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-6 text-foreground min-h-max">
      {/* PAGE HEADER */}
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Box className="w-5 h-5 text-blue-500" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {username ? `@${username}'s Workspace` : 'Overview'}
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">Real-time engineering intelligence for your entire codebase</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/settings">
            <Button variant="outline" className="gap-2 bg-surface text-muted-foreground hover:text-white border-white/5">
              <Settings className="w-4 h-4" /> Settings
            </Button>
          </Link>
          <Dialog open={isAnalysisOpen} onOpenChange={(open) => { setIsAnalysisOpen(open); if (!open) { setResultsSearch(""); setResultsFilter("all"); } }}>
            <DialogTrigger render={<Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-[0_0_15px_rgba(37,99,235,0.3)]" />}>
              <Plus className="w-4 h-4" /> New Analysis
            </DialogTrigger>
            <DialogContent className={`bg-surface border-white/10 text-white transition-all ${report && !analyzing ? 'sm:max-w-4xl' : 'sm:max-w-2xl'}`}>
              <DialogHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <DialogTitle>Run Impact Analysis</DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                      Describe a feature request or bug fix. Syntrix will map out the architectural impact across all services.
                    </DialogDescription>
                  </div>
                  {report && !analyzing && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setReport(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </DialogHeader>
              <div className="mt-4 flex flex-col gap-4">
                {!report && <PromptBox onAnalyze={handleAnalyze} />}
                {analyzing && (
                  <div className="h-64">
                    <StreamLog events={[{ stage: 'started', message: 'Fetching repository graph…' }]} isSimulating />
                  </div>
                )}
                {report && !analyzing && (
                  <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto">
                    <p className="text-sm text-muted-foreground bg-black/20 rounded-lg p-3 border border-white/5">{report.summary}</p>
                    <RepoFilters search={resultsSearch} onSearch={setResultsSearch} filter={resultsFilter} onFilter={setResultsFilter} />
                    <ImpactCards report={report} filter={resultsFilter} search={resultsSearch} />
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* TOP KPI GRID */}
      <div className="grid grid-cols-6 gap-4">
        {[
          { label: "Repositories", value: repoCount || "0", sub: "Selected for analysis", icon: Box, subColor: "text-emerald-400" },
          { label: "Analyses Run", value: analysisCount || "0", sub: "Total insights generated", icon: Sparkles, subColor: "text-emerald-400" },
          { label: "Overall Health", value: "—", sub: "Coming soon", icon: HeartPulse, subColor: "text-muted-foreground" },
          { label: "Active Agents", value: "0", sub: "Running now", icon: Bot, subColor: "text-muted-foreground" },
          { label: "Open PRs", value: "0", sub: "Awaiting review", icon: GitPullRequest, subColor: "text-muted-foreground" },
          { label: "Risks Detected", value: "0", sub: "No critical risks", icon: ShieldAlert, subColor: "text-emerald-400" },
        ].map((kpi, i) => (
          <div key={i} className="bg-surface rounded-xl p-4 flex flex-col gap-2 relative overflow-hidden group">
            <div className="flex items-center gap-3 text-muted-foreground mb-1">
              <kpi.icon className="w-4 h-4" />
              <span className="text-xs font-medium">{kpi.label}</span>
            </div>
            <div className="text-3xl font-bold tracking-tight text-white">{kpi.value}</div>
            <div className={`text-xs ${kpi.subColor}`}>{kpi.sub}</div>
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          </div>
        ))}
      </div>

      {/* MIDDLE SECTION: Graph (Span 2) + Right Sidebar (Span 1) */}
      <div className="grid grid-cols-3 gap-4 min-h-[500px]">

        {/* Architecture Graph Panel */}
        <div className="col-span-2 bg-surface rounded-xl flex flex-col overflow-hidden relative border border-white/5">
          <div className="p-4 border-b border-white/5 flex justify-between items-center shrink-0 z-10 bg-surface">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                Architecture Graph
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-muted-foreground border border-white/10 flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Live
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mt-1">{repoCount} repositories mapped</p>
            </div>
          </div>

          <div className="flex-1 relative bg-[#0B1120]">
             <DependencyGraph />
          </div>
        </div>

        {/* Right Sidebar Stack */}
        <div className="col-span-1 flex flex-col gap-4">

          {/* Recent Activity */}
          <div className="bg-surface rounded-xl p-4 flex-1 flex flex-col border border-white/5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-sm">Recent Activity</h3>
            </div>
            <div className="text-sm text-muted-foreground flex items-center justify-center flex-1">
              No recent activity yet.
            </div>
          </div>

          {/* AI Recommendations */}
          <div className="bg-surface rounded-xl p-4 flex-1 flex flex-col border border-white/5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-sm">AI Recommendations</h3>
            </div>
            <div className="space-y-3">
              {report?.affectedRepos?.length > 0 ? report.affectedRepos.slice(0, 3).map((finding: any, i: number) => {
                const isHigh = finding.disposition === 'must_change';
                return (
                  <div key={i} className={`p-3 rounded-lg border ${isHigh ? 'border-red-500/30 bg-red-500/5' : 'border-amber-500/30 bg-amber-500/5'} flex flex-col gap-1 hover:bg-white/5 transition-colors cursor-pointer`}>
                    <p className="text-sm font-medium text-white font-mono">{finding.repoId}</p>
                    <p className="text-xs text-muted-foreground">{finding.rationale || 'Requires review for feature compliance'}</p>
                    <div className="flex gap-3 mt-1 text-[10px]">
                      <span className={`font-semibold ${isHigh ? 'text-red-400' : 'text-amber-400'}`}>{isHigh ? 'High Impact' : 'Medium Impact'}</span>
                    </div>
                  </div>
                );
              }) : (
                <div className="text-sm text-muted-foreground italic py-4 text-center">
                  Run an analysis to see recommendations here.
                </div>
              )}
            </div>
          </div>

          {/* Top Risks */}
          <div className="bg-surface rounded-xl p-4 border border-white/5">
             <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-sm">Top Risks</h3>
            </div>
            <div className="text-sm text-muted-foreground flex items-center justify-center py-6">
              No risks detected yet.
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION: 3 Columns */}
      <div className="grid grid-cols-3 gap-4 pb-4">
        {/* AI Agents */}
        <div className="bg-surface rounded-xl p-4 border border-white/5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-sm">AI Agents <span className="text-muted-foreground font-normal text-xs ml-1">0 running</span></h3>
          </div>
          <div className="space-y-4">
             <div className="text-sm text-muted-foreground flex items-center justify-center h-32">
               No agents currently active.
             </div>
          </div>
        </div>

        {/* Repository Health */}
        <div className="bg-surface rounded-xl p-4 border border-white/5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-sm">Repository Health</h3>
          </div>
          <div className="text-sm text-muted-foreground flex items-center justify-center h-32">
            Repository health scoring is not yet available.
          </div>
        </div>

        {/* Commit Activity */}
        <div className="bg-surface rounded-xl p-4 flex flex-col border border-white/5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-sm">Commit Activity</h3>
          </div>
          <div className="text-sm text-muted-foreground flex items-center justify-center h-32">
            Commit activity tracking is not yet available.
          </div>
        </div>
      </div>

    </div>
  );
}
