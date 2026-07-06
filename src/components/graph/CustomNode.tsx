import { Handle, Position } from 'reactflow';
import { cn } from '@/lib/utils';
import { Box, Code2, Database, LayoutTemplate } from 'lucide-react';

export function CustomNode({ data, selected }: any) {
  const { label, type, impactSeverity, isFocalNode } = data;

  let borderColor = "border-white/10";
  const bgColor = "bg-[#1E293B]";
  const textColor = "text-white";
  let iconColor = "text-white";
  let iconBg = "bg-white/10";
  let badgeColor = "bg-white/10 text-white border-white/20";
  let badgeText = "";

  if (impactSeverity === 'must_change') {
    borderColor = "border-red-500/50";
    iconColor = "text-red-400";
    iconBg = "bg-red-500/10";
    badgeColor = "bg-red-500 text-white border-red-600";
    badgeText = "High Impact";
  } else if (impactSeverity === 'may_change') {
    borderColor = "border-amber-500/50";
    iconColor = "text-amber-400";
    iconBg = "bg-amber-500/10";
    badgeColor = "bg-amber-500/20 text-amber-400 border-amber-500/30";
    badgeText = "Medium Impact";
  } else if (isFocalNode) {
    borderColor = "border-blue-500";
    iconColor = "text-blue-400";
    iconBg = "bg-blue-500/20";
    badgeColor = "bg-blue-500 text-white border-blue-600";
    badgeText = "Focal Point";
  } else if (type === 'Repo') {
    iconColor = "text-blue-400";
    iconBg = "bg-blue-500/10";
  }

  // Choose icon
  let Icon = Box;
  if (type === 'Repo') Icon = Database;
  if (type === 'Package') Icon = Code2;
  if (type === 'App') Icon = LayoutTemplate;

  return (
    <div className={cn(
      "px-3 py-2 rounded-lg border flex items-center gap-3 min-w-[160px] shadow-lg transition-all duration-300",
      borderColor, bgColor,
      selected ? "ring-1 ring-white" : ""
    )}>
      <Handle type="target" position={Position.Top} className="!bg-blue-500 !w-1.5 !h-1.5 !border-none" />
      
      <div className={cn("w-7 h-7 rounded flex items-center justify-center shrink-0", iconBg, iconColor)}>
        <Icon size={14} />
      </div>
      
      <div className="flex flex-col min-w-0 flex-1">
        <span className={cn("text-xs font-medium truncate", textColor)}>
          {label}
        </span>
        {badgeText ? (
          <span className={cn("text-[8px] font-bold px-1 py-0.5 rounded border uppercase mt-0.5 w-max", badgeColor)}>
            {badgeText}
          </span>
        ) : (
          <span className="text-[9px] text-muted-foreground truncate">{type}</span>
        )}
      </div>
      
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-1.5 !h-1.5 !border-none" />
    </div>
  );
}
