"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { IconLink } from "@/components/icon-link";

export function NotificationsBell({
  userId,
  initialCount,
}: {
  userId: string;
  initialCount: number;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  // New activity changes the number right away
  useEffect(() => {
    async function refresh() {
      const { count: unread } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);

      setCount(unread ?? 0);
    }

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => void refresh()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  return (
    <IconLink
      href="/notifications"
      name="bell"
      label={count > 0 ? `Activity, ${count} new` : "Activity"}
      badge={count}
    />
  );
}