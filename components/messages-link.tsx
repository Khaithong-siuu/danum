import { createClient } from "@/lib/supabase/server";
import { IconLink } from "@/components/icon-link";

export async function MessagesLink() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: rows } = await supabase
    .from("conversation_members")
    .select("last_read_at, conversations(last_message_at)")
    .eq("user_id", user.id);

  type ConvMemberRow = {
    last_read_at: string;
    conversations: { last_message_at: string } | { last_message_at: string }[] | null;
  };

  const unread = ((rows as unknown as ConvMemberRow[]) ?? []).filter((row) => {
    const conv = Array.isArray(row.conversations)
      ? row.conversations[0]
      : row.conversations;
    return (
      conv &&
      new Date(conv.last_message_at).getTime() >
        new Date(row.last_read_at).getTime()
    );
  }).length;

  return (
    <IconLink
      href="/messages"
      name="chat"
      label={unread > 0 ? `Messages, ${unread} unread` : "Messages"}
      badge={unread}
    />
  );
}