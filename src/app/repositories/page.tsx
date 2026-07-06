"use client";

import { useEffect, useState } from "react";
import { Database, Search, Loader2, GitBranch, Clock } from "lucide-react";
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
    r.fullName.toLowerCase().includes(search.toLowerCase())
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
            <p className="text-sm text-muted-foreground">Manage your imported codebases</p>
          </div>
        </div>
        
        <Link href="/onboarding">
          <Button className="bg-white hover:bg-neutral-200 text-black">
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
              placeholder="Search repositories..."
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
            <div className="flex justify-center items-center h-64 text-muted-foreground">
              {search ? "No repositories match your search." : "No repositories imported yet."}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-2">
              {filteredRepos.map(repo => (
                <div key={repo.id} className="p-5 rounded-lg border border-white/10 bg-black/40 hover:bg-black/60 transition-colors flex flex-col gap-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-white truncate max-w-[200px]" title={repo.fullName}>
                        {repo.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">{repo.owner}</p>
                    </div>
                    <a href={`https://github.com/${repo.fullName}`} target="_blank" rel="noreferrer" className="p-1.5 hover:bg-white/10 rounded text-muted-foreground hover:text-white transition-colors">
                      <GitBranch className="w-4 h-4" />
                    </a>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-auto pt-4 border-t border-white/5">
                    <Clock className="w-3.5 h-3.5" />
                    Imported {formatDistanceToNow(new Date(repo.createdAt), { addSuffix: true })}
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
