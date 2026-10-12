"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_DAYS = new Set([1, 7, 30]);

type Result = { ok: boolean; error?: string };

async function adminClient() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, error: "Please sign in again." };

  // Checked here and again inside the database functions
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) return { supabase, error: "Not allowed." };

  return { supabase, error: null as string | null };
}

export async function suspendUser(input: {
  targetId: string;
  reason: string;
  days: number | null;
}): Promise<Result> {
  const { supabase, error: denied } = await adminClient();
  if (denied) return { ok: false, error: denied };

  const targetId = String(input.targetId ?? "");
  const reason = String(input.reason ?? "").trim().slice(0, 300);

  if (!UUID_REGEX.test(targetId)) return { ok: false, error: "Invalid account." };
  if (reason.length < 3) {
    return { ok: false, error: "Give a reason of at least 3 characters." };
  }

  const days = input.days === null ? null : Number(input.days);
  if (days !== null && !ALLOWED_DAYS.has(days)) {
    return { ok: false, error: "Invalid duration." };
  }

  const { error } = await supabase.rpc("suspend_user", {
    p_target: targetId,
    p_reason: reason,
    p_days: days,
  });

  if (error) {
    if (error.message.includes("Cannot suspend an admin")) {
      return { ok: false, error: "You can't suspend an admin." };
    }
    if (error.message.includes("Invalid target")) {
      return { ok: false, error: "You can't suspend yourself." };
    }
    return { ok: false, error: "Could not suspend this account." };
  }

  revalidatePath("/admin/users");
  return { ok: true };
}

export async function unsuspendUser(targetId: string): Promise<Result> {
  const { supabase, error: denied } = await adminClient();
  if (denied) return { ok: false, error: denied };

  if (!UUID_REGEX.test(String(targetId ?? ""))) {
    return { ok: false, error: "Invalid account." };
  }

  const { error } = await supabase.rpc("unsuspend_user", { p_target: targetId });

  if (error) return { ok: false, error: "Could not lift the suspension." };

  revalidatePath("/admin/users");
  return { ok: true };
}