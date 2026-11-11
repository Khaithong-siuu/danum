"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "@/components/confirm-dialog";

export function LogoutRow() {
  const supabase = useMemo(() => createClient(), []);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function logOut() {
    setConfirmOpen(false);
    setBusy(true);
    await supabase.auth.signOut();
    // A full reload, so nothing from the old session lingers
    window.location.href = "/auth/login";
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={busy}
        className="glass-card w-full rounded-[22px] py-3.5 text-[15px] font-semibold text-red-500 transition active:scale-[0.99] disabled:opacity-50"
      >
        {busy ? "Logging out…" : "Log out"}
      </button>

      <ConfirmDialog
        open={confirmOpen}
        title="Log out of Danum?"
        confirmLabel="Log out"
        destructive
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void logOut()}
      />
    </>
  );
}
