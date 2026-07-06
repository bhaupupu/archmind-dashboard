"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, User } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    fetch('/api/v1/account')
      .then((res) => (res.status === 401 ? router.push('/login') : res.json()))
      .then((data) => data && setUsername(data.username))
      .catch(console.error);
  }, [router]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await fetch('/api/v1/account', { method: 'DELETE' });
    } finally {
      router.push('/login');
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <div className="bg-surface rounded-xl p-5 border border-white/5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <User className="w-6 h-6 text-blue-500" />
        </div>
        <div>
          <p className="font-semibold text-white">{username ?? 'Loading…'}</p>
          <p className="text-xs text-muted-foreground">Connected via GitHub</p>
        </div>
      </div>

      <div className="bg-surface rounded-xl p-5 border border-red-500/20 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-red-400">
          <AlertTriangle className="w-4 h-4" />
          <h2 className="font-semibold text-sm">Danger Zone</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Permanently delete your account, all onboarded repositories, and analysis history. We&apos;ll also
          attempt to revoke Archmind&apos;s GitHub OAuth grant. This cannot be undone.
        </p>
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogTrigger render={<Button variant="outline" className="w-fit border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300" />}>
            Delete my account and data
          </DialogTrigger>
          <DialogContent className="bg-surface border-white/10 text-white">
            <DialogHeader>
              <DialogTitle>Delete account?</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                This permanently deletes your Archmind account, onboarded repositories, and analysis
                history, and revokes GitHub access. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={deleting}>Cancel</Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Yes, delete everything'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
