"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function FollowButton({
  targetId,
  initialFollowing,
  toggleFollow,
  compact = false,
}: {
  targetId: string;
  initialFollowing: boolean;
  toggleFollow: (targetId: string) => Promise<void>;
  compact?: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [, startTransition] = useTransition();

  async function handleClick() {
    const next = !following;
    setFollowing(next);

    try {
      await toggleFollow(targetId);
      startTransition(() => router.refresh());
    } catch {
      setFollowing(!next);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`rounded-lg font-semibold transition active:scale-95 ${
        compact ? "px-3 py-1 text-sm" : "px-5 py-1.5 text-sm"
      } ${
        following
          ? "bg-foreground/10 text-foreground"
          : "bg-brand text-white hover:opacity-90"
      }`}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}