import { ComingSoon } from "@/components/layout/ComingSoon";
import { ShieldAlert } from "lucide-react";

export default function RisksPage() {
  return (
    <ComingSoon
      icon={ShieldAlert}
      title="Risks & Recommendations"
      description="A dedicated view of detected risks — circular dependencies, outdated packages, high coupling — across your organization. This view is under construction."
    />
  );
}
