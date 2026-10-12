"use client";

import { useState } from "react";

export function ShareButton({
  postId,
  caption,
}: {
  postId: number;
  caption?: string | null;
}) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = `${window.location.origin}/#post-${postId}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Danum",
          text: caption || "Check out this post on Danum",
          url,
        });
      } catch {
        // user cancelled the share sheet
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="text-sm font-medium text-foreground/80 hover:text-foreground transition"
    >
      {copied ? "✅ Link copied" : "🔗 Share"}
    </button>
  );
}