"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Sheet } from "@/components/sheet";
import { ListenTogether } from "@/components/listen-together";
import type { Track } from "@/lib/music";
import type { ListeningSession } from "@/lib/listening";
import {
  CHAT_THEMES,
  getChatTheme,
  isChatTheme,
  type ChatThemeKey,
} from "@/lib/chat-themes";

export type ChatMessage = {
  id: number;
  sender_id: string;
  content: string;
  created_at: string;
};

const REEL_MARKER = /^\[reel:(\d{1,12})\]$/;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ChatRoom({
  conversationId,
  currentUserId,
  other,
  initialMessages,
  initialTheme,
  initialListening,
  markRead,
  saveTheme,
  searchListenTracks,
  startListening,
  setListeningPlayback,
  stopListening,
  getServerTime,
}: {
  conversationId: string;
  currentUserId: string;
  other: { username: string; avatarUrl: string | null };
  initialMessages: ChatMessage[];
  initialTheme: ChatThemeKey;
  initialListening: ListeningSession | null;
  markRead: (conversationId: string) => Promise<void>;
  saveTheme: (conversationId: string, theme: string) => Promise<boolean>;
  searchListenTracks: (query: string) => Promise<Track[]>;
  startListening: (conversationId: string, trackId: number) => Promise<boolean>;
  setListeningPlayback: (
    conversationId: string,
    playing: boolean,
    positionMs: number
  ) => Promise<boolean>;
  stopListening: (conversationId: string) => Promise<boolean>;
  getServerTime: () => Promise<number>;
}) {
  const supabase = useMemo(() => createClient(), []);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [themeKey, setThemeKey] = useState<ChatThemeKey>(initialTheme);
  const [pickerOpen, setPickerOpen] = useState(false);

  const t = getChatTheme(themeKey);

  // Mark as read when the chat opens
  useEffect(() => {
    void markRead(conversationId);
  }, [conversationId, markRead]);

  // Live messages and live theme changes
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const incoming = payload.new as ChatMessage;

          setMessages((prev) =>
            prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]
          );

          if (incoming.sender_id !== currentUserId) {
            void markRead(conversationId);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `id=eq.${conversationId}`,
        },
        (payload) => {
          const next = (payload.new as { theme?: unknown }).theme;
          if (isChatTheme(next)) setThemeKey(next);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, conversationId, currentUserId, markRead]);

  // Keep the newest message in view
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();

    const content = text.trim();
    if (!content || sending) return;

    setSending(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, content })
      .select("id, sender_id, content, created_at")
      .single();

    setSending(false);

    if (insertError || !data) {
      setError("Message not sent. Please try again.");
      return;
    }

    setText("");
    setMessages((prev) =>
      prev.some((m) => m.id === data.id) ? prev : [...prev, data as ChatMessage]
    );
  }

  async function chooseTheme(key: ChatThemeKey) {
    const previous = themeKey;

    setThemeKey(key);
    setPickerOpen(false);
    setError(null);

    const ok = await saveTheme(conversationId, key).catch(() => false);

    if (!ok) {
      setThemeKey(previous);
      setError("Couldn't change the theme. Please try again.");
    }
  }

  return (
    <div className="h-[100dvh] w-full" style={{ background: t.bg, color: t.text }}>
      <div className="mx-auto flex h-full max-w-md flex-col">
        {/* Header */}
        <header
          className="flex items-center gap-3 border-b px-4 py-3 backdrop-blur-md"
          style={{ background: t.panel, borderColor: t.border }}
        >
          <Link href="/messages" aria-label="Back to messages" className="text-xl">
            ←
          </Link>
          {other.avatarUrl ? (
            <Image
              src={other.avatarUrl}
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 rounded-full object-cover"
            />
          ) : (
            <div className="h-9 w-9 rounded-full" style={{ background: t.theirs }} />
          )}
          <Link
            href={`/u/${other.username}`}
            className="min-w-0 flex-1 truncate font-semibold hover:underline"
          >
            {other.username}
          </Link>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            aria-label="Change chat theme"
            className="text-xl"
          >
            🎨
          </button>
        </header>

        {/* Listen together */}
        <ListenTogether
          conversationId={conversationId}
          theme={t}
          initialSession={initialListening}
          searchTracks={searchListenTracks}
          startListening={startListening}
          setPlayback={setListeningPlayback}
          stopListening={stopListening}
          getServerTime={getServerTime}
        />

        {/* Messages */}
        <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <p className="py-10 text-center text-sm" style={{ color: t.muted }}>
              No messages yet. Say hi 👋
            </p>
          )}

          {messages.map((m) => {
            const mine = m.sender_id === currentUserId;
            const reelMatch = REEL_MARKER.exec(m.content);

            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="max-w-[80%] rounded-2xl px-3 py-2 text-sm"
                  style={{
                    background: mine ? t.mine : t.theirs,
                    color: mine ? t.mineText : t.theirsText,
                  }}
                >
                  {reelMatch ? (
                    <Link
                      href={`/p/${reelMatch[1]}`}
                      className="block font-semibold hover:underline"
                    >
                      ▶ Shared a post
                      <span className="block text-xs font-normal opacity-80">
                        Tap to open
                      </span>
                    </Link>
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  )}
                  <p
                    className="mt-1 text-[10px] opacity-70"
                    suppressHydrationWarning
                  >
                    {formatTime(m.created_at)}
                  </p>
                </div>
              </div>
            );
          })}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={handleSend}
          className="border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md"
          style={{ background: t.panel, borderColor: t.border }}
        >
          {error && <p className="mb-2 text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={1000}
              placeholder="Message..."
              className="flex-1 rounded-full border px-4 py-2 text-sm outline-none"
              style={{
                background: t.input,
                color: t.text,
                borderColor: t.border,
              }}
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className="px-2 text-sm font-semibold disabled:opacity-40"
              style={{ color: t.accent }}
            >
              Send
            </button>
          </div>
        </form>
      </div>

      {/* Theme picker */}
      {pickerOpen && (
        <Sheet title="Chat theme" onClose={() => setPickerOpen(false)}>
          <div className="grid grid-cols-4 gap-4 pb-4">
            {CHAT_THEMES.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => void chooseTheme(option.key)}
                className="flex flex-col items-center gap-1.5 text-xs"
              >
                <span
                  className={`block h-14 w-14 rounded-full ${
                    themeKey === option.key
                      ? "ring-2 ring-brand ring-offset-2 ring-offset-background"
                      : "ring-1 ring-foreground/10"
                  }`}
                  style={{ background: option.swatch }}
                />
                <span
                  className={
                    themeKey === option.key ? "font-semibold" : "text-foreground/70"
                  }
                >
                  {option.label}
                </span>
              </button>
            ))}
          </div>
          <p className="pb-6 text-center text-xs text-foreground/50">
            Both of you will see the new theme.
          </p>
        </Sheet>
      )}
    </div>
  );
}