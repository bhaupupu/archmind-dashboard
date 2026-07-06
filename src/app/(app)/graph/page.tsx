"use client";

import { DependencyGraph } from "@/components/graph/DependencyGraph";
import { Share2 } from "lucide-react";

export default function GraphPage() {
  return (
    <div className="flex flex-col h-screen overflow-hidden p-6 gap-6">
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <Share2 className="w-5 h-5 text-indigo-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Architecture Graph</h1>
          <p className="text-sm text-muted-foreground">Interactive map of all imported repositories</p>
        </div>
      </div>
      
      <div className="bg-surface border border-white/10 rounded-xl overflow-hidden flex-1 relative">
        <DependencyGraph />
      </div>
    </div>
  );
}
