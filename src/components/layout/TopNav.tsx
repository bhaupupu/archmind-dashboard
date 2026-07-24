"use client";

import { useState, useEffect } from "react";
import { 
  CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem 
} from "@/components/ui/command";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuGroup 
} from "@/components/ui/dropdown-menu";
import { Search, Bell, Settings, LogOut, User, Database, Share2, Activity, Box, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Repo = {
  id: string;
  name: string;
  fullName: string;
  owner: string;
};

export function TopNav() {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState<string>("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetch("/api/v1/account")
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.username) {
          setUsername(data.username);
        }
      })
      .catch(console.error);

    fetch("/api/v1/repos")
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.repos) {
          setRepos(data.repos);
        }
      })
      .catch(console.error);
  }, []);

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
            Search repositories...
          </div>
          <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50 border border-white/10">⌘K</span>
          </div>
        </div>

        <CommandDialog open={open} onOpenChange={setOpen}>
          <CommandInput 
            placeholder="Type a repository name or query..." 
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>No matching repositories found.</CommandEmpty>
            
            {filteredRepos.length > 0 && (
              <CommandGroup heading="Imported Repositories">
                {filteredRepos.slice(0, 8).map((repo) => (
                  <CommandItem 
                    key={repo.id} 
                    onSelect={() => {
                      setOpen(false);
                      router.push('/repositories');
                    }}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-emerald-400" />
                      <span>{repo.fullName}</span>
                    </div>
                    <a 
                      href={`https://github.com/${repo.fullName}`} 
                      target="_blank" 
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-muted-foreground hover:text-white flex items-center gap-1"
                    >
                      GitHub <ExternalLink className="w-3 h-3" />
                    </a>
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
