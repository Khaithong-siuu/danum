"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resolveReports } from "@/app/actions/admin";

export function AdminReportActions({
  targetType,
  targetId,
  canRemove,
}: {
  targetType: "post" | "comment" | "user";
  targetId: string;
  canRemove: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "remove" | "reviewed" | "dismissed") {
    if (busy) return;

    if (
      action === "remove" &&
      !window.confirm(`Permanently remove this ${targetType}? This can't be undone.`)
    ) {
      return;
    }

    setBusy(true);
    setError(null);

    const result = await resolveReports({ targetType, targetId, action }).catch(
      () => ({ ok: false, error: "Something went wrong." })
    );

    setBusy(false);

    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      return;
    }

    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {canRemove && (
          <button
            type="button"
            onClick={() => void run("remove")}
            disabled={busy}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Remove {targetType}
          </button>
        )}
        <button
          type="button"
          onClick={() => void run("reviewed")}
          disabled={busy}
          className="rounded-lg bg-foreground/10 px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
        >
          Mark reviewed
        </button>
        <button
          type="button"
          onClick={() => void run("dismissed")}
          disabled={busy}
          className="rounded-lg bg-foreground/10 px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
        >
          Dismiss
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}