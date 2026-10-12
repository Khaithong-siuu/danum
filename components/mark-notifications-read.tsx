"use client";

import { useEffect } from "react";

// Marks everything as read a moment after the page opens, so the "New"
// highlighting stays visible while you look at it
export function MarkNotificationsRead({
  markRead,
}: {
  markRead: () => Promise<void>;
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      void markRead().catch(() => {});
    }, 1500);

    return () => clearTimeout(timer);
  }, [markRead]);

  return null;
}