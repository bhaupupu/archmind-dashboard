"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

export function RepoFilters({ 
  search, 
  onSearch, 
  filter, 
  onFilter 
}: { 
  search: string; 
  onSearch: (val: string) => void;
  filter: string;
  onFilter: (val: string) => void;
}) {
  return (
    <div className="flex gap-2 items-center">
      <div className="relative w-64">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Filter repositories..." 
          className="pl-8 bg-background h-9"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      <div className="flex bg-muted/50 p-1 rounded-md">
        <Button 
          variant={filter === "all" ? "secondary" : "ghost"} 
          size="sm" 
          className="h-7 text-xs"
          onClick={() => onFilter("all")}
        >
          All
        </Button>
        <Button 
          variant={filter === "must_change" ? "secondary" : "ghost"} 
          size="sm" 
          className="h-7 text-xs text-destructive"
          onClick={() => onFilter("must_change")}
        >
          Must Change
        </Button>
        <Button 
          variant={filter === "may_change" ? "secondary" : "ghost"} 
          size="sm" 
          className="h-7 text-xs"
          onClick={() => onFilter("may_change")}
        >
          May Change
        </Button>
      </div>
    </div>
  );
}
