import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { isStorageImageUrl } from "@/lib/safe-url";
import { isChatTheme } from "@/lib/chat-themes";
import { rowToSession, type ListeningRow } from "@/lib/listening";
import { ChatRoom, type ChatMessage } from "@/components/chat-room";
import {
  getServerTime,
  searchListenTracks,
  setListeningPlayback,
  startListening,
  stopListening,
} from "@/app/actions/listen";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function markRead(conversationId: string) {
  "use server";

  if (!UUID_REGEX.test(conversationId)) return;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.rpc("mark_conversation_read", { conv: conversationId });
}

async function saveTheme(conversationId: string, theme: string): Promise<boolean> {
  "use server";

  if (!UUID_REGEX.test(conversationId) || !isChatTheme(theme)) return false;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  // The database only lets members of this chat change its theme
  const { error } = await supabase.rpc("set_conversation_theme", {
    conv: conversationId,
    new_theme: theme,
  });

  return !error;
}

async function ChatContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!UUID_REGEX.test(id)) notFound();

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Row Level Security only returns members for conversations you are in
  const { data: members } = await supabase
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", id);

  if (!members || !members.some((m) => m.user_id === user.id)) notFound();

  const otherId = members.find((m) => m.user_id !== user.id)?.user_id;
  if (!otherId) notFound();

  const [{ data: other }, { data: conversation }, { data: rows }, { data: listening }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .eq("id", otherId)
        .maybeSingle(),
      supabase.from("conversations").select("theme").eq("id", id).maybeSingle(),
      supabase
        .from("messages")
        .select("id, sender_id, content, created_at")
        .eq("conversation_id", id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("listening_sessions")
        .select(
          "track_id, title, artist, preview_url, artwork_url, is_playing, position_ms, updated_at"
        )
        .eq("conversation_id", id)
        .maybeSingle(),
    ]);

  if (!other?.username) notFound();

  const initialMessages: ChatMessage[] = (rows ?? []).reverse();
  const avatarUrl = isStorageImageUrl(other.avatar_url) ? other.avatar_url : null;
  const theme = conversation?.theme;

  return (
    <ChatRoom
      conversationId={id}
      currentUserId={user.id}
      other={{ username: other.username, avatarUrl }}
      initialMessages={initialMessages}
      initialTheme={isChatTheme(theme) ? theme : "default"}
      initialListening={rowToSession(listening as ListeningRow | null)}
      markRead={markRead}
      saveTheme={saveTheme}
      searchListenTracks={searchListenTracks}
      startListening={startListening}
      setListeningPlayback={setListeningPlayback}
      stopListening={stopListening}
      getServerTime={getServerTime}
    />
  );
}

export default function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading chat...</div>}>
      <ChatContent params={params} />
    </Suspense>
  );
}