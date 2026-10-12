import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { isStorageImageUrl } from "@/lib/safe-url";
import { timeAgo } from "@/lib/time";

function fail(message: string): never {
  redirect(`/messages?error=${encodeURIComponent(message)}`);
}

// A shared post is stored as a small marker; show something readable instead
function previewText(content: string): string {
  return /^\[reel:\d{1,12}\]$/.test(content) ? "Shared a post" : content;
}

async function startChat(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const raw = ((formData.get("username") as string) || "")
    .trim()
    .replace(/^@/, "")
    .slice(0, 30);

  if (!raw) {
    fail("Enter a username.");
  }

  // Case-insensitive match, with LIKE wildcards in the username escaped
  const escaped = raw.replace(/[\\%_]/g, "\\$&");

  const { data: target } = await supabase
    .from("profiles")
    .select("id, username")
    .ilike("username", escaped)
    .maybeSingle();

  if (!target) {
    fail("We couldn't find that username.");
  }
  if (target.id === user.id) {
    fail("You can't message yourself.");
  }

  const { data: conversationId, error } = await supabase.rpc("start_conversation", {
    other_user: target.id,
  });

  if (error || !conversationId) {
    fail("Could not start the chat. Please try again.");
  }

  redirect(`/messages/${conversationId}`);
}

type InboxItem = {
  id: string;
  profile: { id: string; username: string; avatar_url: string | null };
  lastContent: string | null;
  lastSenderIsMe: boolean;
  lastAt: string;
  unread: boolean;
};

async function InboxContent({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: mine } = await supabase
    .from("conversation_members")
    .select("conversation_id, last_read_at")
    .eq("user_id", user.id);

  const convIds = (mine ?? []).map((m) => m.conversation_id);
  let items: InboxItem[] = [];

  if (convIds.length > 0) {
    const [{ data: convs }, { data: members }, { data: recent }] = await Promise.all([
      supabase
        .from("conversations")
        .select("id, last_message_at")
        .in("id", convIds)
        .order("last_message_at", { ascending: false }),
      supabase
        .from("conversation_members")
        .select("conversation_id, user_id")
        .in("conversation_id", convIds)
        .neq("user_id", user.id),
      supabase
        .from("messages")
        .select("conversation_id, sender_id, content, created_at")
        .in("conversation_id", convIds)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    const otherIds = [...new Set((members ?? []).map((m) => m.user_id))];

    const { data: profiles } = otherIds.length
      ? await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .in("id", otherIds)
      : { data: [] as { id: string; username: string; avatar_url: string | null }[] };

    const readAt = new Map((mine ?? []).map((m) => [m.conversation_id, m.last_read_at]));

    // First hit per conversation is its most recent message
    const lastMessage = new Map<string, { sender_id: string; content: string }>();
    for (const m of recent ?? []) {
      if (!lastMessage.has(m.conversation_id)) lastMessage.set(m.conversation_id, m);
    }

    items = (convs ?? []).flatMap((c) => {
      const otherId = members?.find((m) => m.conversation_id === c.id)?.user_id;
      const profile = profiles?.find((p) => p.id === otherId);
      if (!profile?.username) return [];

      const last = lastMessage.get(c.id);
      const read = readAt.get(c.id);

      return [
        {
          id: c.id,
          profile,
          lastContent: last?.content ?? null,
          lastSenderIsMe: last?.sender_id === user.id,
          lastAt: c.last_message_at,
          unread:
            !!read &&
            new Date(c.last_message_at).getTime() > new Date(read).getTime(),
        },
      ];
    });
  }

  return (
    <div className="max-w-md mx-auto mt-6 p-6">
      <Link href="/" className="text-sm text-foreground/60 hover:text-foreground">
        ← Back to feed
      </Link>

      <h1 className="text-3xl font-bold mt-4 mb-6">Messages</h1>

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <form action={startChat} className="mb-6 flex gap-2">
        <input
          type="text"
          name="username"
          placeholder="New message to... (username)"
          maxLength={30}
          required
          className="flex-1 rounded-full border bg-background px-4 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
        >
          Chat
        </button>
      </form>

      {items.length === 0 ? (
        <p className="py-16 text-center text-foreground/60">
          No conversations yet. Enter a username above to start one.
        </p>
      ) : (
        <ul className="divide-y divide-foreground/10">
          {items.map((item) => {
            const avatar = isStorageImageUrl(item.profile.avatar_url)
              ? item.profile.avatar_url
              : null;

            return (
              <li key={item.id}>
                <Link
                  href={`/messages/${item.id}`}
                  className="flex items-center gap-3 py-3 hover:bg-foreground/5"
                >
                  {avatar ? (
                    <Image
                      src={avatar}
                      alt=""
                      width={48}
                      height={48}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-foreground/10" />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p
                        className={`truncate ${
                          item.unread ? "font-bold" : "font-semibold"
                        }`}
                      >
                        {item.profile.username}
                      </p>
                      <span className="shrink-0 text-xs text-foreground/50">
                        {timeAgo(item.lastAt)}
                      </span>
                    </div>
                    <p
                      className={`truncate text-sm ${
                        item.unread ? "font-medium" : "text-foreground/60"
                      }`}
                    >
                      {item.lastContent
                        ? `${item.lastSenderIsMe ? "You: " : ""}${previewText(item.lastContent)}`
                        : "Say hi 👋"}
                    </p>
                  </div>

                  {item.unread && (
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading messages...</div>}>
      <InboxContent searchParams={searchParams} />
    </Suspense>
  );
}