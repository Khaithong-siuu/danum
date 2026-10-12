"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/icons";

export function UserMenu({
  username,
  avatarUrl,
  isAdmin,
}: {
  username: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Close when you tap outside or press Escape
  useEffect(() => {
    if (!open) return;

    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function logOut() {
    setBusy(true);
    await supabase.auth.signOut();
    // A full reload, so nothing from the old session lingers
    window.location.href = "/auth/login";
  }

  const initial = (username?.[0] ?? "?").toUpperCase();

  const itemClass =
    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-foreground/5";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        className="ml-1 flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-foreground/10 text-sm font-semibold ring-1 ring-foreground/10 transition active:scale-95"
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 object-cover"
          />
        ) : (
          initial
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-foreground/10 bg-background p-1.5 shadow-xl">
          {username && (
            <p className="truncate px-3 pb-1 pt-2 text-xs text-foreground/50">
              Signed in as <span className="font-semibold">{username}</span>
            </p>
          )}

          <Link href="/profile" onClick={() => setOpen(false)} className={itemClass}>
            <Icon name="user" className="h-5 w-5" />
            Profile
          </Link>
          <Link
            href="/reels/saved"
            onClick={() => setOpen(false)}
            className={itemClass}
          >
            <Icon name="bookmark" className="h-5 w-5" />
            Saved
          </Link>

          {isAdmin && (
            <>
              <div className="my-1 h-px bg-foreground/10" />
              <p className="px-3 pb-1 pt-1 text-xs font-medium uppercase tracking-wide text-foreground/50">
                Admin
              </p>
              <Link
                href="/admin/reports"
                onClick={() => setOpen(false)}
                className={itemClass}
              >
                Reports
              </Link>
              <Link
                href="/admin/users"
                onClick={() => setOpen(false)}
                className={itemClass}
              >
                Accounts
              </Link>
            </>
          )}

          <div className="my-1 h-px bg-foreground/10" />
          <button
            type="button"
            onClick={() => void logOut()}
            disabled={busy}
            className={`${itemClass} text-red-600 disabled:opacity-50`}
          >
            {busy ? "Logging out..." : "Log out"}
          </button>
        </div>
      )}
    </div>
  );
}