"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Clock, Code2 } from "lucide-react";

export function ImpactCards({ report, filter, search }: { report: any; filter: string; search: string }) {
  if (!report) {
    return (
      <div className="text-sm text-muted-foreground italic p-4 border rounded bg-muted/20">
        Run an analysis to see affected repositories.
      </div>
    );
  }

  // Derived properties and filtering
  let findings = report.affectedRepos || [];
  
  if (search) {
    findings = findings.filter((f: any) => f.repoId.toLowerCase().includes(search.toLowerCase()));
  }
  
  if (filter === "must_change") {
    findings = findings.filter((f: any) => f.disposition === "must_change");
  } else if (filter === "may_change") {
    findings = findings.filter((f: any) => f.disposition === "may_change");
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {findings.map((finding: any) => {
        // Compute Risk
        const risk = finding.disposition === "must_change" ? "High" : 
                     finding.disposition === "may_change" ? "Medium" : "Low";
        
        // Compute Effort from plans
        const plan = report.plans?.find((p: any) => p.repoId === finding.repoId);
        const effortItems = plan ? (plan.requiredChanges?.length || 0) + (plan.testingRequirements?.length || 0) + (plan.migrationRequirements?.length || 0) : 0;
        const effortDays = Math.max(1, Math.ceil(effortItems / 2)); // rough estimation: 2 items per day

        return (
          <div key={finding.repoId} className="relative group animate-in fade-in zoom-in duration-500 fill-mode-both" style={{ animationDelay: `${Math.random() * 200}ms` }}>
            {/* Glowing Backdrop */}
            <div className={`absolute -inset-0.5 rounded-xl blur opacity-30 group-hover:opacity-60 transition duration-500 ${
              finding.disposition === "must_change" ? "bg-gradient-to-br from-red-600 to-rose-400" :
              finding.disposition === "may_change" ? "bg-gradient-to-br from-amber-600 to-yellow-400" : "bg-gradient-to-br from-blue-600 to-cyan-400"
            }`}></div>
            
            <Card className="relative h-full flex flex-col bg-background/80 backdrop-blur-md border-white/10 rounded-xl overflow-hidden shadow-2xl transition-transform hover:-translate-y-1">
              <div className={`h-1 w-full ${
                finding.disposition === "must_change" ? "bg-gradient-to-r from-red-500 to-rose-400" :
                finding.disposition === "may_change" ? "bg-gradient-to-r from-amber-500 to-yellow-400" : "bg-gradient-to-r from-blue-500 to-cyan-400"
              }`} />
              <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex justify-between items-start text-sm">
                <span className="font-mono text-primary truncate" title={finding.repoId}>{finding.repoId}</span>
                <Badge 
                  variant="outline"
                  className={`${
                    finding.disposition === "must_change" ? "bg-red-500/10 text-red-400 border-red-500/30" : 
                    finding.disposition === "may_change" ? "bg-amber-500/10 text-amber-400 border-amber-500/30" : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                  } font-bold uppercase tracking-wider text-[10px]`}
                >
                  {finding.disposition.replace("_", " ")}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-3">
              <p className="text-sm text-muted-foreground font-medium leading-snug">
                {finding.rationale}
              </p>
              
              <div className="flex flex-col gap-2 mt-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <AlertTriangle className={`w-3.5 h-3.5 ${risk === 'High' ? 'text-red-400' : 'text-amber-400'}`} />
                  <span className={risk === 'High' ? 'text-destructive' : 'text-amber-500'}>Risk: {risk}</span>
                </div>
                {plan && (
                  <div className="flex flex-col gap-1 text-xs text-muted-foreground bg-zinc-900 p-2 rounded">
                    <div className="flex items-center gap-1 font-semibold text-blue-400 mb-1">
                      <Clock className="w-3 h-3" /> Effort Estimates
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                      <span>Implementation:</span> <span className="text-zinc-300">~{plan.requiredChanges?.length || 0}d</span>
                      <span>Testing:</span> <span className="text-zinc-300">~{plan.testingRequirements?.length || 0}d</span>
                      <span>Migration:</span> <span className="text-zinc-300">~{plan.migrationRequirements?.length || 0}d</span>
                      <span className="font-bold border-t border-zinc-700 pt-1 mt-1">Total:</span> 
                      <span className="font-bold text-blue-400 border-t border-zinc-700 pt-1 mt-1">~{effortDays}d</span>
                    </div>
                  </div>
                )}
              </div>

              {finding.evidence && finding.evidence.length > 0 && (
                <div className="mt-auto pt-4 border-t border-white/5">
                  <span className="text-xs font-semibold uppercase text-zinc-500 flex items-center gap-1 mb-2">
                    <Code2 className="w-3 h-3" /> Evidence
                  </span>
                  <ScrollArea className="h-24 bg-zinc-950 p-2 rounded border border-zinc-800">
                    <ul className="text-xs font-mono text-zinc-300 space-y-1">
                      {finding.evidence.map((ev: any, idx: number) => (
                        <li key={idx} className="truncate" title={ev.kind === 'file' ? `${ev.path}:${ev.startLine}` : `Graph: ${ev.edgeType}`}>
                          {ev.kind === 'file' ? (
                            <span>{ev.path}<span className="text-zinc-500">:{ev.startLine}</span></span>
                          ) : (
                            <span className="text-amber-500">Edge {ev.edgeType} &rarr; {ev.edgeId}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        );
      })}
      {findings.length === 0 && (
        <div className="col-span-full text-sm text-muted-foreground italic p-4 border rounded bg-muted/20">
          No repositories found matching the current filters.
        </div>
      )}
    </div>
  );
}
