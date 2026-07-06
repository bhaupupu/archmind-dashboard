"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Box, Check, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

type Repo = {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  description: string;
  language: string;
};

export default function OnboardingPage() {
  const router = useRouter();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetch('/api/v1/onboarding/repos')
      .then(res => res.json())
      .then(data => {
        if (data.repositories) {
          setRepos(data.repositories);
        } else if (data.error === 'unauthorized') {
          router.push('/login');
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [router]);

  const toggleRepo = (id: number) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  const handleContinue = async () => {
    if (selected.size === 0) return;
    
    setSaving(true);
    const selectedRepos = repos.filter(r => selected.has(r.id));
    
    try {
      const res = await fetch('/api/v1/onboarding/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repositories: selectedRepos })
      });
      
      if (res.ok) {
        router.push('/');
      } else {
        console.error('Failed to save repos');
        setSaving(false);
      }
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  };

  const filteredRepos = repos.filter(r => 
    r.fullName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0B1120] flex flex-col items-center py-12 px-4">
      <div className="max-w-3xl w-full">
        
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
            <Box className="w-6 h-6 text-blue-500" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Select Repositories</h1>
          <p className="text-muted-foreground">
            Choose the GitHub repositories you want Archmind to analyze and index.
          </p>
        </div>

        <div className="bg-surface border border-white/10 rounded-2xl flex flex-col overflow-hidden h-[600px]">
          <div className="p-4 border-b border-white/10 bg-black/20">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                className="pl-9 bg-black/40 border-white/10 focus-visible:ring-1 focus-visible:ring-blue-500 h-10" 
                placeholder="Search repositories..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          
          <ScrollArea className="flex-1 p-2">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            ) : filteredRepos.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No repositories found.
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {filteredRepos.map(repo => (
                  <div 
                    key={repo.id}
                    onClick={() => toggleRepo(repo.id)}
                    className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-colors border ${
                      selected.has(repo.id) 
                        ? 'bg-blue-500/10 border-blue-500/30' 
                        : 'border-transparent hover:bg-white/5'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                      selected.has(repo.id)
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'border-white/20'
                    }`}>
                      {selected.has(repo.id) && <Check className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{repo.fullName}</p>
                      {repo.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{repo.description}</p>
                      )}
                    </div>
                    {repo.language && (
                      <span className="text-[10px] text-muted-foreground px-2 py-1 rounded-full bg-white/5 whitespace-nowrap">
                        {repo.language}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="p-4 border-t border-white/10 bg-black/20 flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              {selected.size} {selected.size === 1 ? 'repository' : 'repositories'} selected
            </span>
            <Button 
              onClick={handleContinue} 
              disabled={selected.size === 0 || saving}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {saving ? 'Saving...' : 'Import Selected'}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
