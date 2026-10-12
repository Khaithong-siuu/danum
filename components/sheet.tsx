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
      className="fixed inset-0 z-50 flex items-end bg-black/40"
      onClick={onClose}
    >
      <div
        className={`mx-auto flex w-full max-w-xl flex-col rounded-t-3xl bg-background text-foreground shadow-2xl ${
          tall ? "h-[85dvh]" : "max-h-[70dvh]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-4 pb-3 pt-2 text-center">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-foreground/20" />
          <p className="text-sm font-semibold">{title}</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4">{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-foreground/10 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}