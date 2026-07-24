"use client";

import { useEffect, useState } from "react";
import { Database, Search, Loader2, GitBranch, Clock, ExternalLink, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type Repo = {
  id: string;
  githubId: number;
  name: string;
  fullName: string;
  owner: string;
  createdAt: string;
  updatedAt: string;
};

export default function RepositoriesPage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch('/api/v1/repos')
      .then(res => res.json())
      .then(data => {
        if (data.repos) {
          setRepos(data.repos);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredRepos = repos.filter(r => 
    r.fullName.toLowerCase().includes(search.toLowerCase()) ||
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 p-6 min-h-max text-foreground">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Database className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Repositories</h1>
            <p className="text-sm text-muted-foreground">Manage and explore your {repos.length} imported codebases</p>
          </div>
        </div>
        
        <Link href="/onboarding">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white font-medium">
            Import More
          </Button>
        </Link>
      </div>

      <div className="bg-surface border border-white/10 rounded-xl overflow-hidden flex-1 flex flex-col">
        <div className="p-4 border-b border-white/10 bg-black/20 flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              className="pl-9 bg-black/40 border-white/10 focus-visible:ring-1 focus-visible:ring-emerald-500 h-10" 
              placeholder="Search imported repositories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        <ScrollArea className="flex-1 p-2">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
          ) : filteredRepos.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-64 text-muted-foreground gap-3">
              <p>{search ? "No repositories match your search." : "No repositories imported yet."}</p>
              {!search && (
                <Link href="/onboarding">
                  <Button variant="outline" className="border-white/10 text-white">Import Repositories</Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-2">
              {filteredRepos.map(repo => (
                <a
                  key={repo.id}
                  href={`https://github.com/${repo.fullName}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-5 rounded-lg border border-white/10 bg-black/40 hover:bg-black/70 hover:border-blue-500/40 transition-all flex flex-col gap-4 group cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-white group-hover:text-blue-400 transition-colors truncate max-w-[220px]" title={repo.fullName}>
                        {repo.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{repo.owner}</p>
                    </div>
                    <div className="p-2 hover:bg-white/10 rounded-md text-muted-foreground group-hover:text-white transition-colors">
                      <ExternalLink className="w-4 h-4" />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto pt-4 border-t border-white/5">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Imported {formatDistanceToNow(new Date(repo.createdAt), { addSuffix: true })}
                    </div>
                    <span className="text-[10px] text-blue-400 group-hover:underline flex items-center gap-1 font-medium">
                      GitHub <GitBranch className="w-3 h-3" />
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
