import { LucideIcon } from "lucide-react";

export function ComingSoon({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[70vh] gap-4 p-6 text-center">
      <div className="w-14 h-14 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
        <Icon className="w-7 h-7 text-blue-500" />
      </div>
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground max-w-md">{description}</p>
      <span className="px-2.5 py-1 rounded-full bg-white/5 text-muted-foreground text-xs font-medium border border-white/10">
        Coming soon
      </span>
    </div>
  );
}
