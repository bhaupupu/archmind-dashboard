import { Button } from "@/components/ui/button"
import { Box, GitPullRequest } from "lucide-react"
import Link from "next/link"

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#0B1120] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-surface border border-white/10 rounded-2xl p-8 flex flex-col items-center text-center">
        
        <div className="w-16 h-16 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-6">
          <Box className="w-8 h-8 text-blue-500" />
        </div>
        
        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">Welcome to Archmind</h1>
        <p className="text-muted-foreground text-sm mb-8">
          The autonomous architecture intelligence platform. Connect your GitHub account to get started.
        </p>

        <a href="/api/v1/auth/github/login" className="w-full">
          <Button className="w-full bg-white hover:bg-neutral-200 text-black font-semibold h-12 gap-3 text-base">
            <GitPullRequest className="w-5 h-5" />
            Continue with GitHub
          </Button>
        </a>

        <p className="mt-4 text-xs text-muted-foreground/80 text-left w-full">
          Archmind requests the <code className="text-white/70">repo</code> scope so it can read file
          contents (including private repositories you choose to onboard) to build dependency graphs and
          impact analyses. Your GitHub token is encrypted at rest and never sent to the AI model. You can
          revoke access from GitHub&apos;s settings, or delete your account and all stored data from Archmind&apos;s
          settings page at any time.
        </p>

        <p className="mt-4 text-xs text-muted-foreground">
          By continuing, you agree to our <Link href="/terms" className="underline hover:text-white">Terms of Service</Link> and <Link href="/privacy" className="underline hover:text-white">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  )
}
