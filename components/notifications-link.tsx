import { createClient } from "@/lib/supabase/server";
import { NotificationsBell } from "@/components/notifications-bell";

export async function NotificationsLink() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);

  return <NotificationsBell userId={user.id} initialCount={count ?? 0} />;
}