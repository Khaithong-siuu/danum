"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { suspendUser, unsuspendUser } from "@/app/actions/suspensions";

const DURATIONS = [
  { value: "1", label: "1 day" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "forever", label: "Until I lift it" },
];

export function AdminUserActions({
  targetId,
  username,
  suspended,
}: {
  targetId: string;
  username: string;
  suspended: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("7");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function suspend() {
    if (busy) return;

    if (reason.trim().length < 3) {
      setError("Give a reason of at least 3 characters.");
      return;
    }
    if (!window.confirm(`Suspend ${username}?`)) return;

    setBusy(true);
    setError(null);

    const result = await suspendUser({
      targetId,
      reason,
      days: duration === "forever" ? null : Number(duration),
    }).catch(() => ({ ok: false, error: "Something went wrong." }));

    setBusy(false);

    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      return;
    }

    setOpen(false);
    setReason("");
    router.refresh();
  }

  async function lift() {
    if (busy) return;
    if (!window.confirm(`Lift the suspension on ${username}?`)) return;

    setBusy(true);
    setError(null);

    const result = await unsuspendUser(targetId).catch(() => ({
      ok: false,
      error: "Something went wrong.",
    }));

    setBusy(false);

    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      return;
    }

    router.refresh();
  }

  if (suspended) {
    return (
      <div>
        <button
          type="button"
          onClick={() => void lift()}
          disabled={busy}
          className="rounded-lg bg-foreground/10 px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
        >
          {busy ? "..." : "Lift suspension"}
        </button>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white"
        >
          Suspend…
        </button>
      ) : (
        <div className="space-y-2 rounded-xl border border-foreground/10 p-3">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            placeholder="Reason (the user will see this)"
            className="w-full rounded border bg-background px-3 py-2 text-sm"
          />

          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full rounded border bg-background px-3 py-2 text-sm"
          >
            {DURATIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void suspend()}
              disabled={busy}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Suspending..." : "Confirm suspension"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              disabled={busy}
              className="rounded-lg bg-foreground/10 px-3 py-1.5 text-sm font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}