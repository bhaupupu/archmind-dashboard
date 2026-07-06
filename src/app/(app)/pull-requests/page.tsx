import { ComingSoon } from "@/components/layout/ComingSoon";
import { GitPullRequest } from "lucide-react";

export default function PullRequestsPage() {
  return (
    <ComingSoon
      icon={GitPullRequest}
      title="Pull Requests"
      description="Review and track pull requests Archmind has proposed across your repositories. Automated PR generation is under construction."
    />
  );
}
