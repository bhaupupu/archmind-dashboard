"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Box, Database, Share2, Activity, GitBranch, GitPullRequest,
  Bot, ShieldAlert, Lightbulb, LineChart, Settings,
  PlusCircle, FolderGit2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import Link from "next/link";

type Repo = {
  id: string;
  name: string;
  fullName: string;
};

export function Sidebar() {
  const pathname = usePathname();
  const [repos, setRepos] = useState<Repo[]>([]);

  useEffect(() => {
    fetch("/api/v1/repos")
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.repos) {
          setRepos(data.repos);
        }
      })
      .catch(console.error);
  }, [pathname]);

  const navItems = [
    { name: "Overview", icon: Box, href: "/" },
    { name: "Repositories", icon: Database, href: "/repositories" },
    { name: "Architecture Graph", icon: Share2, href: "/graph" },
    { name: "Analyses", icon: Activity, href: "/analyses" },
    { name: "Workflows", icon: GitBranch, href: "/workflows" },
    { name: "Pull Requests", icon: GitPullRequest, href: "/pull-requests" },
    { name: "Agents", icon: Bot, href: "/agents" },
    { name: "Risks", icon: ShieldAlert, href: "/risks" },
    { name: "Recommendations", icon: Lightbulb, href: "/recommendations" },
    { name: "Insights", icon: LineChart, href: "/insights" },
  ];

  return (
    <div className="w-[260px] border-r border-border bg-sidebar flex flex-col h-screen overflow-hidden shrink-0">
      <div className="p-5 flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center font-bold text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]">
          S
        </div>
        <span className="font-bold text-lg tracking-wide text-foreground">SYNTRIX</span>
      </div>

      <ScrollArea className="flex-1 px-3">
        <div className="space-y-1 mb-8">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
            return (
              <Link href={item.href} key={item.name} className="block w-full">
                <Button 
                  variant="ghost" 
                  className={cn(
                    "w-full justify-start gap-3 hover:bg-white/5",
                    isActive 
                      ? "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 hover:text-blue-500 font-medium" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <item.icon className="w-4 h-4" /> {item.name}
                </Button>
              </Link>
            );
          })}
        </div>

        <div className="mb-4">
          <h3 className="px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Imported Repositories</h3>
          <div className="space-y-1">
            {repos.length === 0 ? (
              <div className="px-4 py-2 text-xs text-muted-foreground italic">
                No repositories imported yet.
              </div>
            ) : (
              repos.slice(0, 8).map((repo) => (
                <a 
                  href={`https://github.com/${repo.fullName}`}
                  target="_blank"
                  rel="noreferrer"
                  key={repo.id} 
                  className="block w-full"
                >
                  <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground hover:bg-white/5 text-xs truncate">
                    <FolderGit2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="truncate">{repo.name}</span>
                  </Button>
                </a>
              ))
            )}

            <Link href="/onboarding" className="block w-full mt-2">
              <Button variant="ghost" className="w-full justify-start gap-3 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 text-xs">
                <PlusCircle className="w-3.5 h-3.5" /> Import Repositories
              </Button>
            </Link>
          </div>
        </div>
      </ScrollArea>
      
      <div className="p-3 border-t border-border mt-auto">
        <Link href="/settings" className="block w-full">
          <Button variant="ghost" className="w-full justify-start gap-3 text-muted-blue hover:text-foreground hover:bg-white/5">
            <Settings className="w-4 h-4" /> Settings
          </Button>
        </Link>
      </div>
    </div>
  );
}
