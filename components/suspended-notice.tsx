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
        <p className="mb-3 text-4xl" aria-hidden="true">
          ⛔
        </p>
        <h1 className="mb-2 text-2xl font-bold">Your account is suspended</h1>

        <p className="mb-4 text-sm text-foreground/70">
          You can&apos;t post, comment or message while your account is suspended,
          and other people can&apos;t see your profile.
        </p>

        <div className="mb-4 rounded-xl border border-foreground/10 p-4 text-left text-sm">
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