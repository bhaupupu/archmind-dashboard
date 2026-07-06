"use client";

import { DependencyGraph } from "@/components/graph/DependencyGraph";
import { Button } from "@/components/ui/button";
import { UserPlus, Settings, Plus, Box, HeartPulse, Sparkles, Bot, GitPullRequest, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PromptBox } from "@/components/dashboard/PromptBox";

export default function DashboardPage() {
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState<any>(null);

  const handleAnalyze = async (prompt: string) => {
    setAnalyzing(true);
    try {
      const res = await fetch('/api/v1/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const data = await res.json();
      setReport(data);
      setIsAnalysisOpen(false);
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
              <h1 className="text-2xl font-bold tracking-tight">Payment Platform</h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Healthy
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">Real-time engineering intelligence for your entire codebase</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2 bg-surface text-muted-foreground hover:text-white border-white/5">
            <UserPlus className="w-4 h-4" /> Invite
          </Button>
          <Button variant="outline" className="gap-2 bg-surface text-muted-foreground hover:text-white border-white/5">
            <Settings className="w-4 h-4" /> Settings
          </Button>
          <Dialog open={isAnalysisOpen} onOpenChange={setIsAnalysisOpen}>
            <DialogTrigger render={<Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-[0_0_15px_rgba(37,99,235,0.3)]" />}>
              <Plus className="w-4 h-4" /> New Analysis
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl bg-surface border-white/10 text-white">
              <DialogHeader>
                <DialogTitle>Run Impact Analysis</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Describe a feature request or bug fix. Archmind will map out the architectural impact across all services.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4">
                <PromptBox onAnalyze={handleAnalyze} />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* TOP KPI GRID */}
      <div className="grid grid-cols-6 gap-4">
        {[
          { label: "Repositories", value: "84", sub: "↑ 3 this week", icon: Box, subColor: "text-emerald-400" },
          { label: "Overall Health", value: "97%", sub: "↑ 2% vs last week", icon: HeartPulse, subColor: "text-emerald-400" },
          { label: "AI Confidence", value: "94%", sub: "High confidence", icon: Sparkles, subColor: "text-emerald-400" },
          { label: "Active Agents", value: "6", sub: "Running now", icon: Bot, subColor: "text-blue-400" },
          { label: "Open PRs", value: "12", sub: "↑ 4 awaiting review", icon: GitPullRequest, subColor: "text-purple-400" },
          { label: "Risks Detected", value: "7", sub: "2 critical", icon: ShieldAlert, subColor: "text-red-400" },
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
              <p className="text-xs text-muted-foreground mt-1">84 repositories • 312 services • 1,204 dependencies</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs bg-black/20 border-white/10 text-muted-foreground hover:bg-black/40 hover:text-white">Filters</Button>
              <Button variant="outline" size="icon" className="h-8 w-8 bg-black/20 border-white/10 text-muted-foreground hover:bg-black/40 hover:text-white"><Settings className="w-3.5 h-3.5" /></Button>
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
              <span className="text-xs text-blue-400 cursor-pointer hover:underline">View all</span>
            </div>
            <div className="space-y-4">
              {[
                { title: "Analysis completed", desc: "Authentication flow impact analysis", time: "2m ago", color: "text-emerald-400" },
                { title: "Pull request generated", desc: "Refactor payment retry logic", time: "15m ago", color: "text-purple-400" },
                { title: "Risk detected", desc: "Circular dependency in billing module", time: "1h ago", color: "text-red-400" },
                { title: "Repository indexed", desc: "marketing-site", time: "2h ago", color: "text-blue-400" },
                { title: "Workflow started", desc: "Security scan on 84 repositories", time: "3h ago", color: "text-emerald-400" },
              ].map((act, i) => (
                <div key={i} className="flex gap-3">
                  <div className={`mt-0.5 ${act.color}`}>•</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <p className="text-sm text-foreground truncate pr-2">{act.title}</p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">{act.time}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{act.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Recommendations */}
          <div className="bg-surface rounded-xl p-4 flex-1 flex flex-col border border-white/5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-sm">AI Recommendations</h3>
              <span className="text-xs text-blue-400 cursor-pointer hover:underline">View all</span>
            </div>
            <div className="space-y-3">
              {report?.impactedNodes ? report.impactedNodes.slice(0,3).map((node: any, i: number) => {
                const isHigh = node.impactSeverity === 'must_change';
                return (
                  <div key={i} className={`p-3 rounded-lg border ${isHigh ? 'border-red-500/30 bg-red-500/5' : 'border-amber-500/30 bg-amber-500/5'} flex flex-col gap-1 hover:bg-white/5 transition-colors cursor-pointer`}>
                    <p className="text-sm font-medium text-white">Modify {node.name}</p>
                    <p className="text-xs text-muted-foreground">{node.reasoning || 'Requires updates for feature compliance'}</p>
                    <div className="flex gap-3 mt-1 text-[10px]">
                      <span className={`font-semibold ${isHigh ? 'text-red-400' : 'text-amber-400'}`}>{isHigh ? 'High Impact' : 'Medium Impact'}</span>
                      <span className="text-muted-foreground">92% confidence</span>
                    </div>
                  </div>
                )
              }) : [
                { title: "Refactor Authentication Service", desc: "High coupling detected with 7 services", badge: "High Impact", conf: "92%", color: "border-red-500/30 bg-red-500/5", badgeCol: "text-red-400" },
                { title: "Update Dependencies", desc: "12 repositories with vulnerable deps", badge: "Medium Impact", conf: "88%", color: "border-amber-500/30 bg-amber-500/5", badgeCol: "text-amber-400" },
                { title: "Optimize Database Queries", desc: "Slow queries detected in 3 services", badge: "Low Impact", conf: "75%", color: "border-blue-500/30 bg-blue-500/5", badgeCol: "text-blue-400" },
              ].map((rec, i) => (
                <div key={i} className={`p-3 rounded-lg border ${rec.color} flex flex-col gap-1 hover:bg-white/5 transition-colors cursor-pointer`}>
                  <p className="text-sm font-medium text-white">{rec.title}</p>
                  <p className="text-xs text-muted-foreground">{rec.desc}</p>
                  <div className="flex gap-3 mt-1 text-[10px]">
                    <span className={`font-semibold ${rec.badgeCol}`}>{rec.badge}</span>
                    <span className="text-muted-foreground">{rec.conf} confidence</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Risks */}
          <div className="bg-surface rounded-xl p-4 border border-white/5">
             <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-sm">Top Risks</h3>
              <span className="text-xs text-blue-400 cursor-pointer hover:underline">View all</span>
            </div>
            <div className="space-y-3">
               {[
                { title: "Circular Dependency", desc: "billing-service → payment-service → billing-service", tag: "Critical", tColor: "bg-red-500/20 text-red-400" },
                { title: "Outdated Dependencies", desc: "23 repositories using deprecated libraries", tag: "High", tColor: "bg-amber-500/20 text-amber-400" },
                { title: "High Coupling", desc: "user-service coupled with 9 services", tag: "High", tColor: "bg-amber-500/20 text-amber-400" },
                { title: "Low Test Coverage", desc: "notification-service (34% coverage)", tag: "Medium", tColor: "bg-yellow-500/20 text-yellow-400" },
              ].map((risk, i) => (
                <div key={i} className="flex justify-between items-start gap-2 group cursor-pointer">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate group-hover:text-blue-400 transition-colors">{risk.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{risk.desc}</p>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${risk.tColor}`}>{risk.tag}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION: 4 Columns */}
      <div className="grid grid-cols-4 gap-4 pb-4">
        {/* AI Agents */}
        <div className="bg-surface rounded-xl p-4 border border-white/5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-sm">AI Agents <span className="text-emerald-400 font-normal text-xs ml-1">6 running</span></h3>
          </div>
          <div className="space-y-4">
             {[
               { n: "Scope Agent", d: "Analyzing authentication service", p: 92, c: "bg-blue-500" },
               { n: "Analysis Agent", d: "Impact analysis in progress", p: 78, c: "bg-blue-500" },
               { n: "Planning Agent", d: "Generating implementation plan", p: 65, c: "bg-blue-500" },
               { n: "Code Agent", d: "Implementing payment retry logic", p: 40, c: "bg-blue-500" },
               { n: "Review Agent", d: "Reviewing changes", p: 20, c: "bg-blue-500" },
               { n: "Test Agent", d: "Generating test cases", p: 10, c: "bg-blue-500" },
             ].map((ag, i) => (
               <div key={i} className="flex items-center gap-3 text-xs group cursor-pointer">
                 <div className="w-5 h-5 rounded bg-white/5 flex items-center justify-center text-muted-foreground shrink-0 group-hover:bg-blue-500/20 group-hover:text-blue-400 transition-colors">
                   <Bot className="w-3 h-3" />
                 </div>
                 <div className="flex-1 min-w-0">
                   <p className="text-white truncate">{ag.n}</p>
                   <p className="text-[10px] text-muted-foreground truncate">{ag.d}</p>
                 </div>
                 <div className="w-16 shrink-0 flex items-center gap-2">
                   <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                     <div className={`h-full ${ag.c}`} style={{width: `${ag.p}%`}}></div>
                   </div>
                   <span className="text-[9px] text-muted-foreground w-6 text-right">{ag.p}%</span>
                 </div>
               </div>
             ))}
          </div>
        </div>

        {/* Workflow Pipeline */}
        <div className="bg-surface rounded-xl p-4 border border-white/5">
          <div className="flex flex-col mb-4">
            <h3 className="font-semibold text-sm">Workflow Pipeline</h3>
            <span className="text-xs text-muted-foreground">Payment Retry Feature</span>
          </div>
          <div className="space-y-0 relative">
             <div className="absolute top-2 bottom-4 left-2.5 w-px bg-white/10"></div>
             {[
               { step: 1, n: "Scope Analysis", t: "2m", status: "done" },
               { step: 2, n: "Impact Analysis", t: "4m", status: "done" },
               { step: 3, n: "Plan Generation", t: "3m", status: "done" },
               { step: 4, n: "Code Generation", t: "5m", status: "active" },
               { step: 5, n: "Review & Testing", t: "-", status: "pending" },
               { step: 6, n: "PR Creation", t: "-", status: "pending" },
             ].map((wf, i) => (
               <div key={i} className={`flex items-center gap-3 relative py-2 ${wf.status === 'active' ? 'bg-blue-500/10 rounded-lg -mx-2 px-2' : ''}`}>
                 <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold z-10 shrink-0 ${
                   wf.status === 'done' ? 'bg-emerald-500 text-black' : 
                   wf.status === 'active' ? 'bg-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-surface border border-white/20 text-muted-foreground'
                 }`}>
                   {wf.status === 'done' ? '✓' : wf.step}
                 </div>
                 <div className={`flex-1 text-xs truncate ${wf.status === 'active' ? 'text-blue-400 font-medium' : wf.status === 'done' ? 'text-white' : 'text-muted-foreground'}`}>
                   {wf.n}
                 </div>
                 <div className="text-[10px] text-muted-foreground">{wf.t}</div>
               </div>
             ))}
          </div>
        </div>

        {/* Repository Health */}
        <div className="bg-surface rounded-xl p-4 border border-white/5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-sm">Repository Health</h3>
            <span className="text-xs text-blue-400 cursor-pointer hover:underline">View all</span>
          </div>
          <div className="space-y-4">
             {[
               { n: "auth-service", p: 100, c: "bg-emerald-500" },
               { n: "payment-service", p: 98, c: "bg-emerald-500" },
               { n: "user-service", p: 95, c: "bg-emerald-500" },
               { n: "billing-service", p: 85, c: "bg-yellow-500" },
               { n: "notification-service", p: 82, c: "bg-yellow-500" },
               { n: "fraud-service", p: 78, c: "bg-yellow-500" },
               { n: "ledger-service", p: 76, c: "bg-amber-500" },
               { n: "reporting-service", p: 73, c: "bg-amber-500" },
             ].map((rh, i) => (
               <div key={i} className="flex items-center gap-3 text-xs group cursor-pointer">
                 <div className="w-24 truncate text-muted-foreground group-hover:text-white transition-colors">{rh.n}</div>
                 <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                   <div className={`h-full ${rh.c}`} style={{width: `${rh.p}%`}}></div>
                 </div>
                 <div className="w-8 text-right text-white font-medium">{rh.p}%</div>
               </div>
             ))}
          </div>
        </div>

        {/* Commit Activity */}
        <div className="bg-surface rounded-xl p-4 flex flex-col border border-white/5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-sm">Commit Activity</h3>
            <span className="text-xs text-blue-400 cursor-pointer hover:underline">View all</span>
          </div>
          <div className="flex items-center gap-4 text-[10px] mb-4">
             <div className="flex items-center gap-1.5"><div className="w-2 h-0.5 bg-blue-500"></div> Commits</div>
             <div className="flex items-center gap-1.5"><div className="w-2 h-0.5 bg-purple-500"></div> PRs Merged</div>
          </div>
          {/* Simple Mock Chart using SVG */}
          <div className="flex-1 relative w-full h-full min-h-[150px] border-l border-b border-white/10">
            <div className="absolute left-[-22px] top-0 text-[9px] text-muted-foreground h-full flex flex-col justify-between pb-4">
              <span>200</span><span>150</span><span>100</span><span>50</span><span>0</span>
            </div>
            <div className="absolute bottom-[-18px] left-0 w-full text-[9px] text-muted-foreground flex justify-between px-2">
              <span>Apr 27</span><span>Apr 28</span><span>Apr 29</span><span>Apr 30</span><span>May 1</span><span>May 2</span><span>May 3</span>
            </div>
            <svg className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
               <polyline points="0,70 16,68 33,50 50,75 66,60 83,40 100,55" fill="none" stroke="#3b82f6" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
               <polyline points="0,90 16,88 33,80 50,95 66,90 83,85 100,75" fill="none" stroke="#a855f7" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
               <circle cx="16" cy="68" r="3" fill="#3b82f6" /><circle cx="33" cy="50" r="3" fill="#3b82f6" /><circle cx="50" cy="75" r="3" fill="#3b82f6" /><circle cx="66" cy="60" r="3" fill="#3b82f6" /><circle cx="83" cy="40" r="3" fill="#3b82f6" /><circle cx="100" cy="55" r="3" fill="#3b82f6" />
               <circle cx="16" cy="88" r="3" fill="#a855f7" /><circle cx="33" cy="80" r="3" fill="#a855f7" /><circle cx="50" cy="95" r="3" fill="#a855f7" /><circle cx="66" cy="90" r="3" fill="#a855f7" /><circle cx="83" cy="85" r="3" fill="#a855f7" /><circle cx="100" cy="75" r="3" fill="#a855f7" />
            </svg>
          </div>
        </div>
      </div>

    </div>
  );
}
