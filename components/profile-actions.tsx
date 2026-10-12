"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/sheet";
import { ReportSheet } from "@/components/report-sheet";
import { blockUser, unblockUser } from "@/app/actions/safety";

export function ProfileActions({
  targetId,
  username,
  initiallyBlocked,
}: {
  targetId: string;
  username: string;
  initiallyBlocked: boolean;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleBlock() {
    if (busy) return;

    if (!initiallyBlocked) {
      const ok = window.confirm(
        `Block ${username}? They won't be able to see your posts, message you or follow you. You can unblock them any time.`
      );
      if (!ok) return;
    }

    setBusy(true);
    setError(null);

    const result = initiallyBlocked
      ? await unblockUser(targetId).catch(() => ({ ok: false, error: "Something went wrong." }))
      : await blockUser(targetId).catch(() => ({ ok: false, error: "Something went wrong." }));

    setBusy(false);

    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      return;
    }

    setMenuOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        aria-label="More options"
        className="rounded-lg bg-foreground/10 px-3 py-1 text-sm font-semibold"
      >
        ⋯
      </button>

      {menuOpen && (
        <Sheet title={username} onClose={() => setMenuOpen(false)}>
          <div className="space-y-1 pb-6">
            {error && <p className="pb-2 text-xs text-red-600">{error}</p>}

            <button
              type="button"
              onClick={() => void toggleBlock()}
              disabled={busy}
              className="w-full rounded-xl px-3 py-3 text-left text-sm font-medium text-red-600 hover:bg-foreground/5 disabled:opacity-50"
            >
              {initiallyBlocked ? `Unblock ${username}` : `Block ${username}`}
            </button>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setReportOpen(true);
              }}
              className="w-full rounded-xl px-3 py-3 text-left text-sm font-medium text-red-600 hover:bg-foreground/5"
            >
              Report account
            </button>
          </div>
        </Sheet>
      )}

      {reportOpen && (
        <ReportSheet
          targetType="user"
          targetId={targetId}
          onClose={() => setReportOpen(false)}
        />
      )}
    </>
  );
}