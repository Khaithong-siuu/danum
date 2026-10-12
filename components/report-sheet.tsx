"use client";

import { useState } from "react";
import { Sheet } from "@/components/sheet";
import { reportContent } from "@/app/actions/safety";
import {
  REPORT_REASONS,
  type ReportReason,
  type ReportTarget,
} from "@/lib/safety";

const TITLES: Record<ReportTarget, string> = {
  post: "Report post",
  comment: "Report comment",
  user: "Report account",
};

export function ReportSheet({
  targetType,
  targetId,
  onClose,
}: {
  targetType: ReportTarget;
  targetId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reason || sending) return;

    setSending(true);
    setError(null);

    const result = await reportContent({
      targetType,
      targetId,
      reason,
      details,
    }).catch(() => ({ ok: false, error: "Could not send your report." }));

    setSending(false);

    if (!result.ok) {
      setError(result.error ?? "Could not send your report.");
      return;
    }

    setDone(true);
  }

  return (
    <Sheet
      title={TITLES[targetType]}
      onClose={onClose}
      footer={
        done ? (
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-foreground/10 py-3 text-sm font-semibold"
          >
            Done
          </button>
        ) : (
          <div>
            {error && <p className="pb-2 text-xs text-red-600">{error}</p>}
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!reason || sending}
              className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
            >
              {sending ? "Sending..." : "Send report"}
            </button>
          </div>
        )
      }
    >
      {done ? (
        <div className="py-10 text-center">
          <p className="mb-1 text-lg font-semibold">Thanks for letting us know</p>
          <p className="text-sm text-foreground/60">
            We&apos;ll review your report. You can also block the account so you
            don&apos;t see it again.
          </p>
        </div>
      ) : (
        <div className="space-y-3 pb-4">
          <p className="text-sm text-foreground/60">Why are you reporting this?</p>

          <ul className="divide-y divide-foreground/10">
            {REPORT_REASONS.map((r) => (
              <li key={r.key}>
                <button
                  type="button"
                  onClick={() => setReason(r.key)}
                  className="flex w-full items-center justify-between py-3 text-left text-sm"
                >
                  <span className={reason === r.key ? "font-semibold" : ""}>
                    {r.label}
                  </span>
                  <span
                    className={`h-4 w-4 rounded-full border ${
                      reason === r.key
                        ? "border-brand bg-brand"
                        : "border-foreground/30"
                    }`}
                    aria-hidden="true"
                  />
                </button>
              </li>
            ))}
          </ul>

          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Add details (optional)"
            className="w-full resize-none rounded border bg-background px-3 py-2 text-sm"
          />
        </div>
      )}
    </Sheet>
  );
}