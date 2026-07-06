"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, CircleDashed, ArrowRight } from "lucide-react";

export function StreamLog({ events, isSimulating }: { events: any[]; isSimulating: boolean }) {
  // Derive timeline stages from the raw events
  const stages = ["started", "indexing", "scope", "analysis", "synthesis", "complete"];
  
  // Find which stage we're currently in based on the last event
  const lastEvent = events.length > 0 ? events[events.length - 1] : null;
  const currentStageIndex = lastEvent ? stages.indexOf(lastEvent.stage) : -1;

  return (
    <div className="flex flex-col h-full bg-black rounded-lg border border-border p-4 font-mono text-sm shadow-inner">
      <div className="flex justify-between items-center mb-4 text-xs text-muted-foreground border-b border-border pb-2">
        <span>Analysis Timeline</span>
        <span className="flex items-center gap-2">
          {isSimulating && <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>}
          {isSimulating ? "Processing..." : "Idle"}
        </span>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="space-y-4">
          {/* Render Timeline Progress */}
          {events.length > 0 && (
             <div className="flex items-center gap-2 mb-6 text-xs text-muted-foreground bg-zinc-900 p-2 rounded border border-zinc-800 overflow-x-auto">
               {stages.map((stage, i) => (
                 <div key={stage} className="flex items-center gap-2 shrink-0">
                    {i <= currentStageIndex ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <CircleDashed className="w-4 h-4 text-zinc-600" />
                    )}
                    <span className={i <= currentStageIndex ? "text-zinc-200" : ""}>{stage.toUpperCase()}</span>
                    {i < stages.length - 1 && <ArrowRight className="w-3 h-3 mx-1 text-zinc-700" />}
                 </div>
               ))}
             </div>
          )}

          {events.map((log, i) => (
            <div key={i} className="flex gap-4">
              <span className="text-emerald-500 font-semibold w-24 shrink-0">[{log.stage}]</span>
              <span className="text-zinc-300">{log.message}</span>
            </div>
          ))}
          {isSimulating && (
            <div className="flex gap-4 items-center mt-2">
              <Skeleton className="h-4 w-24 bg-zinc-800" />
              <Skeleton className="h-4 w-64 bg-zinc-800" />
            </div>
          )}
          {!isSimulating && events.length === 0 && (
             <div className="text-zinc-500 italic mt-4">Awaiting analysis prompt...</div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
