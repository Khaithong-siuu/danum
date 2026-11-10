"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isReason } from "@/lib/safety";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Result = { ok: boolean; error?: string };

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function reportContent(input: {
  targetType: string;
  targetId: string;
  reason: string;
  details: string;
}): Promise<Result> {
  const { supabase, user } = await currentUser();
  if (!user) return { ok: false, error: "Please sign in again." };

  const targetType = input.targetType;
  const targetId = String(input.targetId ?? "");

  if (!isReason(input.reason)) {
    return { ok: false, error: "Choose a reason." };
  }

  // The thing being reported has to exist, and it can't be your own
  if (targetType === "post") {
    if (!/^\d{1,12}$/.test(targetId)) return { ok: false, error: "Invalid post." };

    const { data: post } = await supabase
      .from("reels")
      .select("user_id")
      .eq("id", Number(targetId))
      .maybeSingle();

    if (!post) return { ok: false, error: "That post no longer exists." };
    if (post.user_id === user.id) {
      return { ok: false, error: "You can't report your own post." };
    }
  } else if (targetType === "comment") {
    if (!/^\d{1,12}$/.test(targetId)) return { ok: false, error: "Invalid comment." };

    const { data: comment } = await supabase
      .from("reel_comments")
      .select("user_id")
      .eq("id", Number(targetId))
      .maybeSingle();

    if (!comment) return { ok: false, error: "That comment no longer exists." };
    if (comment.user_id === user.id) {
      return { ok: false, error: "You can't report your own comment." };
    }
  } else if (targetType === "user") {
    if (!UUID_REGEX.test(targetId)) return { ok: false, error: "Invalid account." };
    if (targetId === user.id) {
      return { ok: false, error: "You can't report yourself." };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", targetId)
      .maybeSingle();

    if (!profile) return { ok: false, error: "That account no longer exists." };
  } else {
    return { ok: false, error: "That can't be reported." };
  }

  // Spam guard, counted by a database function because users can't read the table
  const { data: sent } = await supabase.rpc("reports_sent_last_hour");

  if (typeof sent === "number" && sent >= 20) {
    return { ok: false, error: "You've sent a lot of reports. Try again later." };
  }

  const details = String(input.details ?? "").trim().slice(0, 500);

  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    target_type: targetType,
    target_id: targetId,
    reason: input.reason,
    details: details || null,
  });

  // Already reported by you: treat it as done
  if (error && error.code !== "23505") {
    return { ok: false, error: "Could not send your report. Please try again." };
  }

  return { ok: true };
}

export async function blockUser(targetId: string): Promise<Result> {
  if (!UUID_REGEX.test(targetId)) return { ok: false, error: "Invalid account." };

  const { supabase, user } = await currentUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  if (targetId === user.id) return { ok: false, error: "You can't block yourself." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", targetId)
    .maybeSingle();

  if (!profile) return { ok: false, error: "That account no longer exists." };

  const { error } = await supabase
    .from("blocks")
    .insert({ blocker_id: user.id, blocked_id: targetId });

  // Already blocked is fine
  if (error && error.code !== "23505") {
    return { ok: false, error: "Could not block this account." };
  }

  revalidatePath("/");
  return { ok: true };
}

export async function unblockUser(targetId: string): Promise<Result> {
  if (!UUID_REGEX.test(targetId)) return { ok: false, error: "Invalid account." };

  const { supabase, user } = await currentUser();
  if (!user) return { ok: false, error: "Please sign in again." };

  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("blocker_id", user.id)
    .eq("blocked_id", targetId);

  if (error) return { ok: false, error: "Could not unblock this account." };

  revalidatePath("/");
  return { ok: true };
}