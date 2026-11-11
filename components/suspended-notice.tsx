"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SuspendedNotice({
  reason,
  expiresAt,
}: {
  reason: string;
  expiresAt: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await supabase.auth.signOut();
    // A full reload, so this notice is cleared along with the session
    window.location.href = "/auth/login";
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-500">
          <svg
            viewBox="0 0 24 24"
            className="h-8 w-8"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="m5.6 5.6 12.8 12.8" />
          </svg>
        </div>
        <h1 className="mb-2 text-2xl font-bold tracking-tight">Your account is suspended</h1>

        <p className="mb-4 text-sm text-foreground/70">
          You can&apos;t post, comment or message while your account is suspended,
          and other people can&apos;t see your profile.
        </p>

        <div className="glass-card mb-4 rounded-[22px] p-4 text-left text-sm">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-foreground/50">
            Reason
          </p>
          <p className="mb-3 whitespace-pre-wrap break-words">{reason}</p>

          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-foreground/50">
            Until
          </p>
          <p suppressHydrationWarning>
            {expiresAt
              ? new Date(expiresAt).toLocaleString([], {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "Until an admin lifts it"}
          </p>
        </div>

        <p className="mb-6 text-xs text-foreground/50">
          If you think this is a mistake, please contact the Danum team.
        </p>

        <button
          type="button"
          onClick={() => void signOut()}
          disabled={busy}
          className="w-full rounded-xl bg-foreground/10 py-3 text-sm font-semibold disabled:opacity-50"
        >
          {busy ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </main>
  );
}