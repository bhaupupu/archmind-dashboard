"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const LAST_UPDATED = "2026-07-06";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0B1120] text-foreground p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <Link href="/login" className="text-muted-foreground hover:text-white flex items-center gap-2 w-fit">
          <ArrowLeft className="w-4 h-4" /> Back to Login
        </Link>

        <div>
          <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mb-8">Last updated: {LAST_UPDATED}</p>
          
          <div className="space-y-6 text-sm text-muted-foreground/90">
            <section>
              <h2 className="text-xl font-semibold text-white mb-2">1. Data Collection</h2>
              <p>We collect information you provide directly to us when you create an account, specifically your GitHub username and email address (if public). We also collect metadata about the repositories you explicitly choose to index.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-2">2. Data Usage</h2>
              <p>Your repository metadata is strictly used to provide the architectural impact analysis features of the Archmind platform. We send prompts containing metadata (not raw source code) to Google Gemini API for analysis.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-2">3. Data Protection</h2>
              <p>All sensitive information, including GitHub OAuth tokens and user-provided API keys, are symmetrically encrypted at rest in our database. We do not sell or share your personal data with third parties. You may permanently delete your account and all associated data (repositories, analysis history, and your GitHub token) at any time from the Settings page.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
