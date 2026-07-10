"use client";

import { useState, useEffect } from "react";
import { 
  CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem 
} from "@/components/ui/command";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuGroup 
} from "@/components/ui/dropdown-menu";
import { Search, Bell, Settings, LogOut, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function TopNav() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

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
    }
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <header className="h-14 border-b border-border bg-background flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center text-sm text-muted-foreground gap-2">
        <div className="w-5 h-5 rounded border border-white/20 flex items-center justify-center bg-white/5">
          <span className="text-[10px] text-white">A</span>
        </div>
        Acme Corp <span className="mx-1">›</span> 
        <span className="text-foreground font-medium">Payment Platform</span>
        <span className="text-amber-500 ml-2">★</span>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="relative cursor-text" onClick={() => setOpen(true)}>
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="bg-white/5 border border-white/10 rounded-md py-1.5 pl-9 pr-10 text-sm w-64 text-muted-foreground hover:bg-white/10 transition-colors">
            Search anything...
          </div>
          <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50 border border-white/10">⌘K</span>
          </div>
        </div>

        <CommandDialog open={open} onOpenChange={setOpen}>
          <CommandInput placeholder="Type a command or search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Repositories">
              <CommandItem>payment-service</CommandItem>
              <CommandItem>auth-service</CommandItem>
              <CommandItem>billing-service</CommandItem>
            </CommandGroup>
            <CommandGroup heading="Settings">
              <CommandItem>Profile</CommandItem>
              <CommandItem>Billing</CommandItem>
              <CommandItem>Team</CommandItem>
            </CommandGroup>
          </CommandList>
        </CommandDialog>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center relative cursor-pointer hover:bg-white/20 transition-colors">
            <Bell className="w-4 h-4 text-muted-foreground" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] flex items-center justify-center font-bold text-white border border-background">3</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center cursor-pointer hover:bg-white/20 transition-colors">
            <Settings className="w-4 h-4 text-muted-foreground" />
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger render={
              <button className="w-8 h-8 p-0 rounded-full bg-indigo-500 border border-white/20 flex items-center justify-center overflow-hidden cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500">
                <img src="https://github.com/shadcn.png" alt="Profile" className="w-full h-full object-cover" />
              </button>
            }>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-surface border-white/10 text-white">
              <DropdownMenuGroup>
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />
                <Link href="/settings">
                  <DropdownMenuItem className="focus:bg-white/10 focus:text-white cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                </Link>
                <Link href="/settings">
                  <DropdownMenuItem className="focus:bg-white/10 focus:text-white cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
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
