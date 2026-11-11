import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Your profile IS your public profile (the Instagram way). Editing lives at
// /profile/edit.
export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  redirect(
    profile?.username
      ? `/u/${encodeURIComponent(profile.username)}`
      : "/profile/edit"
  );
}
