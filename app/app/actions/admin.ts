"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: boolean; error?: string };

export async function resolveReports(input: {
  targetType: string;
  targetId: string;
  action: string;
}): Promise<Result> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Please sign in again." };

  // Checked here and again by the database policies on every change below
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) return { ok: false, error: "Not allowed." };

  const { targetType, action } = input;
  const targetId = String(input.targetId ?? "");

  if (
    !["post", "comment", "user"].includes(targetType) ||
    targetId.length === 0 ||
    targetId.length > 64
  ) {
    return { ok: false, error: "Invalid report." };
  }

  if (!["remove", "reviewed", "dismissed"].includes(action)) {
    return { ok: false, error: "Invalid action." };
  }

  if (action === "remove") {
    if (targetType === "user") {
      return { ok: false, error: "Accounts can't be removed here yet." };
    }

    if (!/^\d{1,12}$/.test(targetId)) return { ok: false, error: "Invalid id." };

    const { error } =
      targetType === "post"
        ? await supabase.from("reels").delete().eq("id", Number(targetId))
        : await supabase.from("reel_comments").delete().eq("id", Number(targetId));

    if (error) return { ok: false, error: "Could not remove that content." };
  }

  const { error } = await supabase
    .from("reports")
    .update({
      status: action === "dismissed" ? "dismissed" : "reviewed",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .eq("status", "open");

  if (error) return { ok: false, error: "Could not update the reports." };

  revalidatePath("/admin/reports");
  revalidatePath("/");
  return { ok: true };
}