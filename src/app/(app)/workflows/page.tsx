import { ComingSoon } from "@/components/layout/ComingSoon";
import { GitBranch } from "lucide-react";

export default function WorkflowsPage() {
  return (
    <ComingSoon
      icon={GitBranch}
      title="Workflows"
      description="Track multi-stage agent pipelines (scope, analysis, planning, codegen, review) end to end. This view is under construction."
    />
  );
}
