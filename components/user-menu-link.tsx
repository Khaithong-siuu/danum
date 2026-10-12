import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isStorageImageUrl } from "@/lib/safe-url";
import { UserMenu } from "@/components/user-menu";

export async function UserMenuLink() {
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;

  // Signed out: simple links instead of the menu
  if (!uid) {
    return (
      <div className="flex items-center gap-2 text-sm font-medium">
        <Link href="/auth/login" className="rounded-lg px-3 py-1.5 hover:bg-foreground/5">
          Log in
        </Link>
        <Link
          href="/auth/sign-up"
          className="rounded-lg bg-brand px-3 py-1.5 text-white hover:opacity-90"
        >
          Sign up
        </Link>
      </div>
    );
  }

  const [{ data: profile }, { data: isAdmin }] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, avatar_url")
      .eq("id", uid)
      .maybeSingle(),
    supabase.rpc("is_admin"),
  ]);

  return (
    <UserMenu
      username={profile?.username ?? null}
      avatarUrl={isStorageImageUrl(profile?.avatar_url) ? profile.avatar_url : null}
      isAdmin={isAdmin === true}
    />
  );
}