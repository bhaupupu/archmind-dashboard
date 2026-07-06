import { ComingSoon } from "@/components/layout/ComingSoon";
import { LineChart } from "lucide-react";

export default function InsightsPage() {
  return (
    <ComingSoon
      icon={LineChart}
      title="Insights"
      description="Trends across repository health, commit activity, and analysis history over time. This view is under construction."
    />
  );
}
