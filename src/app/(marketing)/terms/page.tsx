"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const LAST_UPDATED = "2026-07-06";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0B1120] text-foreground p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <Link href="/login" className="text-muted-foreground hover:text-white flex items-center gap-2 w-fit">
          <ArrowLeft className="w-4 h-4" /> Back to Login
        </Link>

        <div>
          <h1 className="text-3xl font-bold mb-4">Terms of Service</h1>
          <p className="text-sm text-muted-foreground mb-8">Last updated: {LAST_UPDATED}</p>
          
          <div className="space-y-6 text-sm text-muted-foreground/90">
            <section>
              <h2 className="text-xl font-semibold text-white mb-2">1. Acceptance of Terms</h2>
              <p>By accessing or using Archmind, you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may not access the service.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-2">2. GitHub Integration</h2>
              <p>Our service requires access to your GitHub repositories (requested via the <code>repo</code> OAuth scope) to read file contents for dependency graphs and impact analysis. We encrypt and securely store your OAuth tokens. You can revoke access at any time through your GitHub settings, or delete your Archmind account and all stored data (including your token) from the Settings page, which also attempts to revoke the GitHub grant on your behalf.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-2">3. Acceptable Use</h2>
              <p>You agree not to abuse the AI analysis endpoints. Rate limiting is enforced, and intentional circumvention of these limits may result in account termination.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
