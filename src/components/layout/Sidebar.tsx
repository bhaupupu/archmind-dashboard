"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Box, Database, Share2, Activity, GitBranch, GitPullRequest, 
  Bot, ShieldAlert, Lightbulb, LineChart, Settings, HelpCircle,
  PlusCircle
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const [active, setActive] = useState("Overview");

  const navItems = [
    { name: "Overview", icon: Box },
    { name: "Repositories", icon: Database },
    { name: "Architecture Graph", icon: Share2 },
    { name: "Analyses", icon: Activity },
    { name: "Workflows", icon: GitBranch },
    { name: "Pull Requests", icon: GitPullRequest },
    { name: "Agents", icon: Bot },
    { name: "Risks", icon: ShieldAlert },
    { name: "Recommendations", icon: Lightbulb },
    { name: "Insights", icon: LineChart },
  ];

  return (
    <div className="w-[260px] border-r border-border bg-sidebar flex flex-col h-screen overflow-hidden shrink-0">
      <div className="p-5 flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-blue-500 flex items-center justify-center">
          <Box className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-lg tracking-wide text-foreground">ARCHMIND</span>
      </div>

      <ScrollArea className="flex-1 px-3">
        <div className="space-y-1 mb-8">
          {navItems.map((item) => (
            <Button 
              key={item.name}
              variant="ghost" 
              onClick={() => setActive(item.name)}
              className={cn(
                "w-full justify-start gap-3 hover:bg-white/5",
                active === item.name 
                  ? "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 hover:text-blue-500 font-medium" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="w-4 h-4" /> {item.name}
            </Button>
          ))}
        </div>


        <div className="mb-4">
          <h3 className="px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recent Projects</h3>
          <div className="space-y-1">
            <Button variant="ghost" className="w-full justify-start gap-3 text-muted-blue hover:text-foreground hover:bg-white/5">
              <span className="w-5 h-5 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">P</span>
              Payment Platform
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3 text-muted-blue hover:text-foreground hover:bg-white/5">
              <span className="w-5 h-5 rounded bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold">I</span>
              Identity Service
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3 text-muted-blue hover:text-foreground hover:bg-white/5">
              <span className="w-5 h-5 rounded bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold">A</span>
              Analytics Platform
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3 text-muted-blue hover:text-foreground hover:bg-white/5">
              <span className="w-5 h-5 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">M</span>
              Marketing Site
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3 text-muted-blue hover:text-foreground hover:bg-white/5">
              <span className="w-5 h-5 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">M</span>
              Mobile App
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground hover:bg-white/5 text-xs mt-2">
              <PlusCircle className="w-3 h-3" /> View all projects
            </Button>
          </div>
        </div>
      </ScrollArea>
      
      <div className="p-3 border-t border-border mt-auto">
        <Button variant="ghost" className="w-full justify-start gap-3 text-muted-blue hover:text-foreground hover:bg-white/5">
          <Settings className="w-4 h-4" /> Settings
        </Button>
        <Button variant="ghost" className="w-full justify-start gap-3 text-muted-blue hover:text-foreground hover:bg-white/5">
          <HelpCircle className="w-4 h-4" /> Help & Docs
        </Button>
      </div>
    </div>
  );
}
