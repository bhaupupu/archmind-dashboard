"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, ShieldAlert, Clock, GitPullRequest, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function NodePanel({ node, report, onClose }: { node: any; report?: any; onClose: () => void }) {
  if (!node) return null;

  // Extract repo ID from node ID (e.g., "repo:auth-lib" -> "auth-lib")
  const rawId = node.id.replace('repo:', '').replace('pkg:', '').replace('app:', '');
  
  // Find finding and plan from report
  const finding = report?.affectedRepos?.find((f: any) => f.repoId === rawId);
  const plan = report?.plans?.find((p: any) => p.repoId === rawId);
  const pr = report?.prs?.find((p: any) => p.repoId === rawId);

  return (
    <div className="absolute right-0 top-0 bottom-0 w-[400px] bg-zinc-950 border-l border-zinc-800 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right">
      <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">{node.data?.type || 'Node'}</span>
          <h3 className="font-bold text-lg text-zinc-100 truncate pr-2">{node.data?.label}</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>
      
      <ScrollArea className="flex-1 p-5">
        <div className="space-y-6 pb-8">
          
          {/* Status Badge */}
          {finding && (
            <div>
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Impact Severity</h4>
              <Badge variant="outline" className={cn(
                "px-3 py-1 font-semibold text-sm",
                finding.disposition === 'must_change' ? "bg-red-950/40 text-red-400 border-red-500/30" :
                finding.disposition === 'may_change' ? "bg-amber-950/40 text-amber-400 border-amber-500/30" :
                "bg-zinc-800 text-zinc-300 border-zinc-700"
              )}>
                {finding.disposition.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
          )}

          {/* Why is this affected? */}
          {finding?.rationale && (
            <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50">
              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Code2 size={14} />
                Why is this affected?
              </h4>
              <p className="text-sm text-zinc-300 leading-relaxed">{finding.rationale}</p>
              
              {finding.evidence && finding.evidence.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h5 className="text-xs font-semibold text-zinc-500 uppercase">Supporting Evidence</h5>
                  {finding.evidence.map((ev: any, i: number) => (
                    <div key={i} className="text-xs bg-black/40 p-2 rounded text-zinc-400 border border-zinc-800 font-mono">
                      {ev.filePath && <div className="text-zinc-300 mb-1">{ev.filePath}:{ev.lineNumbers?.[0]}</div>}
                      {ev.snippet && <div className="truncate opacity-75">{ev.snippet}</div>}
                      {ev.edgeId && <div>Transitive Dependency via {ev.edgeId}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Engineering Effort Estimates */}
          {plan && (
            <div>
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Clock size={14} />
                Effort Estimates
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-zinc-900 p-3 rounded-lg border border-zinc-800 text-center">
                  <div className="text-xl font-bold text-zinc-200">2-4</div>
                  <div className="text-[10px] text-zinc-500 uppercase font-semibold">Hours</div>
                </div>
                <div className="bg-zinc-900 p-3 rounded-lg border border-zinc-800 text-center">
                  <div className="text-xl font-bold text-zinc-200">Medium</div>
                  <div className="text-[10px] text-zinc-500 uppercase font-semibold">Complexity</div>
                </div>
              </div>
            </div>
          )}

          {/* Risk Analysis */}
          {plan && (
            <div className="bg-red-950/10 p-4 rounded-xl border border-red-900/20">
              <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <ShieldAlert size={14} />
                Risk Analysis
              </h4>
              <div className="space-y-3 mt-3">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-bold">Severity</span>
                  <p className="text-sm text-zinc-300">Moderate. Requires updating internal APIs and adjusting downstream consumers.</p>
                </div>
                {plan.side_effects && plan.side_effects.length > 0 && (
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase font-bold">Potential Side Effects</span>
                    <ul className="list-disc pl-4 mt-1 text-sm text-zinc-300 space-y-1">
                      {plan.side_effects.map((se: string, i: number) => (
                        <li key={i}>{se}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-bold">Mitigation Strategy</span>
                  <p className="text-sm text-zinc-300">Run backward compatibility tests (Gate 1) and stage rollout across affected dependents.</p>
                </div>
              </div>
            </div>
          )}

          {/* Pull Request Draft */}
          {pr && (
            <div>
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <GitPullRequest size={14} />
                Suggested PR
              </h4>
              <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-800">
                <div className="text-sm font-semibold text-blue-400 mb-2">{pr.title}</div>
                <div className="text-xs text-zinc-400 whitespace-pre-wrap">{pr.body}</div>
              </div>
            </div>
          )}

          {(!finding && !plan) && (
            <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800/50 text-sm text-zinc-400 text-center">
              Run an analysis to see detailed impact metrics and generated plans for this node.
            </div>
          )}
          
        </div>
      </ScrollArea>
    </div>
  );
}
