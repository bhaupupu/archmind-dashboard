"use client";

import { useEffect, useState } from "react";
import { Box, Activity, Calendar, ArrowRight, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

type AnalysisHistory = {
  id: string;
  prompt: string;
  createdAt: string;
  result: any;
};

export default function AnalysesPage() {
  const [history, setHistory] = useState<AnalysisHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/analyses/history')
      .then(res => res.json())
      .then(data => {
        if (data.history) {
          setHistory(data.history);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-6 p-6 min-h-max text-foreground">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <Activity className="w-5 h-5 text-blue-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analysis History</h1>
          <p className="text-sm text-muted-foreground">Past architectural impact analyses</p>
        </div>
      </div>

      <div className="bg-surface border border-white/10 rounded-xl overflow-hidden flex-1">
        <div className="p-4 border-b border-white/10 bg-black/20 flex items-center justify-between">
          <h2 className="font-semibold text-sm">Recent Runs</h2>
          <span className="text-xs text-muted-foreground">{history.length} records found</span>
        </div>
        
        <ScrollArea className="h-[calc(100vh-220px)]">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : history.length === 0 ? (
            <div className="flex justify-center items-center h-64 text-muted-foreground">
              No analysis history found. Run your first analysis from the Overview dashboard.
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {history.map((item) => (
                <div key={item.id} className="p-6 hover:bg-white/5 transition-colors group cursor-pointer">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-medium text-white text-lg max-w-[80%]">&quot;{item.prompt}&quot;</h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-black/20 rounded p-3 border border-white/5">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Summary</h4>
                      <p className="text-sm text-white/80 line-clamp-3 leading-relaxed">
                        {item.result.summary}
                      </p>
                    </div>
                    
                    <div className="bg-black/20 rounded p-3 border border-white/5">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Impacted Repositories</h4>
                      <div className="flex flex-wrap gap-2">
                        {item.result.affectedRepos?.map((repo: any, i: number) => (
                          <span key={i} className={`px-2 py-1 text-[10px] rounded border ${
                            repo.disposition === 'must_change' ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                          }`}>
                            {repo.repoId}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="text-xs text-blue-400 flex items-center gap-1 font-medium">
                      View Full Details <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
