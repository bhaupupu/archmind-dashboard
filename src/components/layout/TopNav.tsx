"use client";

import { useState, useEffect } from "react";
import { 
  CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem 
} from "@/components/ui/command";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuGroup 
} from "@/components/ui/dropdown-menu";
import { Search, Bell, Settings, LogOut, User, Database, Share2, Activity, Box, ExternalLink, Code2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Repo = {
  id: string;
  name: string;
  fullName: string;
  owner: string;
};

type CodeMatch = {
  path: string;
  repo: string;
  url: string;
  textMatches: string[];
};

export function TopNav() {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState<string>("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [codeResults, setCodeResults] = useState<CodeMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const router = useRouter();

  const fetchRepos = () => {
    fetch("/api/v1/repos")
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.repos) {
          setRepos(data.repos);
        }
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetch("/api/v1/account")
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.username) {
          setUsername(data.username);
        }
      })
      .catch(console.error);

    fetchRepos();
  }, []);

  useEffect(() => {
    if (open) {
      fetchRepos();
    }
  }, [open]);

  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setCodeResults([]);
      setSearching(false);
      return;
    }

    const timer = setTimeout(() => {
      setSearching(true);
      fetch(`/api/v1/search?q=${encodeURIComponent(searchQuery)}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.code) {
            setCodeResults(data.code);
          }
        })
        .catch(console.error)
        .finally(() => setSearching(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleLogout = async () => {
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const filteredRepos = repos.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <header className="h-14 border-b border-border bg-background flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center text-sm text-muted-foreground gap-2">
        <div className="w-5 h-5 rounded border border-white/20 flex items-center justify-center bg-blue-500/20 text-blue-400 font-bold text-xs">
          {username ? username.charAt(0).toUpperCase() : 'S'}
        </div>
        <span className="text-foreground font-medium">
          {username ? `@${username}'s Workspace` : 'Syntrix Workspace'}
        </span>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="relative cursor-text" onClick={() => setOpen(true)}>
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="bg-white/5 border border-white/10 rounded-md py-1.5 pl-9 pr-10 text-sm w-64 text-muted-foreground hover:bg-white/10 transition-colors truncate">
            Search repos & code...
          </div>
          <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50 border border-white/10">⌘K</span>
          </div>
        </div>

        <CommandDialog open={open} onOpenChange={setOpen}>
          <CommandInput 
            placeholder="Search repositories or code files..." 
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {searching && (
              <div className="p-4 flex items-center justify-center text-xs text-muted-foreground gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-400" /> Searching GitHub codebase...
              </div>
            )}
            
            <CommandEmpty>No matching repositories or code files found.</CommandEmpty>
            
            {filteredRepos.length > 0 && (
              <CommandGroup heading="Imported Repositories">
                {filteredRepos.slice(0, 8).map((repo) => (
                  <CommandItem 
                    key={repo.id} 
                    onSelect={() => {
                      setOpen(false);
                      window.open(`https://github.com/${repo.fullName}`, '_blank');
                    }}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-emerald-400" />
                      <span>{repo.fullName}</span>
                    </div>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      GitHub <ExternalLink className="w-3 h-3" />
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {codeResults.length > 0 && (
              <CommandGroup heading="Code & File Matches">
                {codeResults.map((match, i) => (
                  <CommandItem
                    key={i}
                    onSelect={() => {
                      setOpen(false);
                      window.open(match.url, '_blank');
                    }}
                    className="flex flex-col items-start gap-1 cursor-pointer py-2"
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2 font-mono text-xs text-blue-400">
                        <Code2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <span>{match.repo}/{match.path}</span>
                      </div>
                      <ExternalLink className="w-3 h-3 text-muted-foreground" />
                    </div>
                    {match.textMatches.length > 0 && (
                      <p className="text-[11px] text-muted-foreground line-clamp-1 font-mono bg-black/30 p-1 rounded border border-white/5 w-full">
                        {match.textMatches[0]}
                      </p>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            <CommandGroup heading="Navigation">
              <CommandItem onSelect={() => { setOpen(false); router.push("/"); }}>
                <Box className="mr-2 h-4 w-4 text-blue-400" />
                <span>Overview</span>
              </CommandItem>
              <CommandItem onSelect={() => { setOpen(false); router.push("/repositories"); }}>
                <Database className="mr-2 h-4 w-4 text-emerald-400" />
                <span>Repositories</span>
              </CommandItem>
              <CommandItem onSelect={() => { setOpen(false); router.push("/graph"); }}>
                <Share2 className="mr-2 h-4 w-4 text-indigo-400" />
                <span>Architecture Graph</span>
              </CommandItem>
              <CommandItem onSelect={() => { setOpen(false); router.push("/analyses"); }}>
                <Activity className="mr-2 h-4 w-4 text-purple-400" />
                <span>Analyses</span>
              </CommandItem>
              <CommandItem onSelect={() => { setOpen(false); router.push("/settings"); }}>
                <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>Settings</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </CommandDialog>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center relative cursor-pointer hover:bg-white/20 transition-colors">
            <Bell className="w-4 h-4 text-muted-foreground" />
          </div>
          <Link href="/settings">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center cursor-pointer hover:bg-white/20 transition-colors">
              <Settings className="w-4 h-4 text-muted-foreground" />
            </div>
          </Link>
          
          <DropdownMenu>
            <DropdownMenuTrigger render={
              <button className="w-8 h-8 p-0 rounded-full bg-blue-600 border border-white/20 flex items-center justify-center overflow-hidden cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 text-white font-bold text-xs">
                {username ? (
                  <img 
                    src={`https://github.com/${username}.png`} 
                    alt={username} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : null}
                <span>{username ? username.charAt(0).toUpperCase() : 'U'}</span>
              </button>
            }>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-surface border-white/10 text-white">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-mono text-xs text-muted-foreground">
                  {username ? `@${username}` : 'Account'}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />
                <Link href="/settings">
                  <DropdownMenuItem className="focus:bg-white/10 focus:text-white cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile & Settings</span>
                  </DropdownMenuItem>
                </Link>
              </DropdownMenuGroup>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem
                onClick={handleLogout}
                className="focus:bg-red-500/20 focus:text-red-400 cursor-pointer text-red-400"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
