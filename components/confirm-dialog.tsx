"use client";

import { useEffect } from "react";

/**
 * In-site replacement for window.confirm, so the prompt belongs to Danum
 * instead of Chrome ("localhost:3000 says"). Controlled: you own the state.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      }
    };
    // capture, so Escape closes the dialog before any page-level handler runs
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-6 backdrop-blur-[3px] animate-in fade-in-0 duration-200"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="w-[270px] max-w-full overflow-hidden rounded-[14px] glass-dropdown text-center text-foreground animate-in fade-in-0 zoom-in-105 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pb-4 pt-5">
          <h2
            id="confirm-dialog-title"
            className="text-[17px] font-semibold leading-tight"
          >
            {title}
          </h2>
          {message && (
            <p className="mt-1 text-[13px] leading-snug text-foreground/70">
              {message}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 border-t border-foreground/15">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            className="py-3 text-[17px] text-brand transition active:bg-foreground/10"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`border-l border-foreground/15 py-3 text-[17px] font-semibold transition active:bg-foreground/10 ${
              destructive ? "text-red-500" : "text-brand"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}