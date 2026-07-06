"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Play } from "lucide-react";

export function PromptBox({ onAnalyze }: { onAnalyze: (prompt: string) => void }) {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    onAnalyze(prompt);
    setPrompt("");
  };

  return (
    <div className="relative group w-full">
      <form onSubmit={handleSubmit} className="relative flex gap-2 p-1 bg-surface rounded-lg ring-1 ring-white/10 shadow-lg">
        <Input 
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Migrate the authentication module to v2..."
          className="flex-1 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm py-4 placeholder:text-muted-foreground"
        />
        <Button type="submit" className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-6">
          <Play className="w-4 h-4 fill-current" />
          Analyze
        </Button>
      </form>
    </div>
  );
}
