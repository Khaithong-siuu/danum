"use client";

import { useEffect } from "react";

export function Sheet({
  title,
  onClose,
  tall = false,
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
  tall?: boolean;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  // Stop the page behind the sheet from scrolling
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`mx-auto flex w-full max-w-xl flex-col rounded-t-3xl glass-surface border border-foreground/[0.06] text-foreground shadow-[0_-4px_40px_-6px_hsl(var(--foreground)/0.12)] ${
          tall ? "h-[85dvh]" : "max-h-[70dvh]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-4 pb-3 pt-2 text-center">
          <div className="mx-auto mb-2 h-1.5 w-9 rounded-full bg-foreground/25" />
          <p className="text-sm font-semibold">{title}</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4">{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-foreground/[0.08] bg-background/50 backdrop-blur-md px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}