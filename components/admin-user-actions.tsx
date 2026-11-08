"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";
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
  const [confirm, setConfirm] = useState<"suspend" | "lift" | null>(null);

  function requestSuspend() {
    if (busy) return;

    if (reason.trim().length < 3) {
      setError("Give a reason of at least 3 characters.");
      return;
    }

    setError(null);
    setConfirm("suspend");
  }

  async function suspend() {
    if (busy) return;

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

  function requestLift() {
    if (!busy) setConfirm("lift");
  }

  async function lift() {
    if (busy) return;

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

  const dialog = (
    <ConfirmDialog
      open={confirm !== null}
      title={
        confirm === "lift"
          ? `Lift the suspension on ${username}?`
          : `Suspend ${username}?`
      }
      message={
        confirm === "lift"
          ? "They'll be able to use Danum again right away."
          : "They won't be able to post or message until it ends."
      }
      confirmLabel={confirm === "lift" ? "Lift" : "Suspend"}
      destructive={confirm === "suspend"}
      onCancel={() => setConfirm(null)}
      onConfirm={() => {
        const which = confirm;
        setConfirm(null);
        if (which === "suspend") void suspend();
        else if (which === "lift") void lift();
      }}
    />
  );

  if (suspended) {
    return (
      <div>
        {dialog}
        <button
          type="button"
          onClick={requestLift}
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
      {dialog}
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
              onClick={requestSuspend}
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