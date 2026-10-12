"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Sheet } from "@/components/sheet";
import type { Track } from "@/lib/music";
import type { ChatTheme } from "@/lib/chat-themes";
import {
  rowToSession,
  type ListeningRow,
  type ListeningSession,
} from "@/lib/listening";

function durationOf(audio: HTMLAudioElement): number {
  return audio.duration && Number.isFinite(audio.duration) ? audio.duration : 30;
}

// Where in the song both phones should be right now
function targetSeconds(
  s: ListeningSession,
  duration: number,
  offsetMs: number
): number {
  let ms = s.positionMs;
  if (s.isPlaying) {
    ms += Date.now() + offsetMs - new Date(s.updatedAt).getTime();
  }
  return (Math.max(0, ms) / 1000) % duration;
}

function Art({ url, size }: { url: string | null; size: number }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      referrerPolicy="no-referrer"
      className="shrink-0 rounded-md object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="shrink-0 rounded-md bg-foreground/10"
      style={{ width: size, height: size }}
    />
  );
}

export function ListenTogether({
  conversationId,
  theme,
  initialSession,
  searchTracks,
  startListening,
  setPlayback,
  stopListening,
  getServerTime,
}: {
  conversationId: string;
  theme: ChatTheme;
  initialSession: ListeningSession | null;
  searchTracks: (query: string) => Promise<Track[]>;
  startListening: (conversationId: string, trackId: number) => Promise<boolean>;
  setPlayback: (
    conversationId: string,
    playing: boolean,
    positionMs: number
  ) => Promise<boolean>;
  stopListening: (conversationId: string) => Promise<boolean>;
  getServerTime: () => Promise<number>;
}) {
  const supabase = useMemo(() => createClient(), []);
  const audioRef = useRef<HTMLAudioElement>(null);
  const offsetRef = useRef(0);
  const sessionRef = useRef<ListeningSession | null>(initialSession);
  const joinedRef = useRef(false);
  const latest = useRef("");

  const [session, setSession] = useState<ListeningSession | null>(initialSession);
  const [joined, setJoined] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Line this phone's clock up with the database's
  useEffect(() => {
    let cancelled = false;
    const t0 = Date.now();

    getServerTime()
      .then((serverMs) => {
        if (cancelled || !serverMs) return;
        const t1 = Date.now();
        offsetRef.current = serverMs - (t0 + t1) / 2;
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [getServerTime]);

  // Make the audio match the session: right song, right spot, playing or paused
  const apply = useCallback(() => {
    const audio = audioRef.current;
    const s = sessionRef.current;
    if (!audio) return;

    if (!s) {
      audio.pause();
      return;
    }

    if (audio.dataset.src !== s.previewUrl) {
      audio.src = s.previewUrl;
      audio.dataset.src = s.previewUrl;
    }

    // Browsers only allow sound after a tap, so wait until this person has joined
    if (!joinedRef.current) {
      audio.pause();
      return;
    }

    const sync = () => {
      const duration = durationOf(audio);
      const target = targetSeconds(s, duration, offsetRef.current);
      const diff = Math.abs(audio.currentTime - target);

      if (Math.min(diff, duration - diff) > 1) audio.currentTime = target;
    };

    if (audio.readyState >= 1) sync();
    else audio.addEventListener("loadedmetadata", sync, { once: true });

    if (s.isPlaying) {
      void audio.play().catch(() => {
        joinedRef.current = false;
        setJoined(false);
      });
    } else {
      audio.pause();
    }
  }, []);

  useEffect(() => {
    sessionRef.current = session;
    joinedRef.current = joined;
    apply();
  }, [session, joined, apply]);

  useEffect(() => {
    if (!session) setJoined(false);
  }, [session]);

  // Keep both phones from drifting apart while playing
  useEffect(() => {
    if (!session?.isPlaying || !joined) return;
    const id = setInterval(() => apply(), 4000);
    return () => clearInterval(id);
  }, [session?.isPlaying, joined, apply]);

  // Changes made by the other person arrive live
  useEffect(() => {
    const channel = supabase
      .channel(`listen:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "listening_sessions",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setSession(null);
            return;
          }
          setSession(rowToSession(payload.new as ListeningRow));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, conversationId]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      audio?.pause();
    };
  }, []);

  // Search as you type, after a short pause
  useEffect(() => {
    const q = query.trim();
    latest.current = q;

    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);

    const timer = setTimeout(() => {
      searchTracks(q)
        .then((r) => {
          if (latest.current === q) setResults(r);
        })
        .catch(() => {
          if (latest.current === q) setResults([]);
        })
        .finally(() => {
          if (latest.current === q) setSearching(false);
        });
    }, 400);

    return () => clearTimeout(timer);
  }, [query, searchTracks]);

  // Called straight from a tap, so the browser allows sound
  function join() {
    joinedRef.current = true;
    setJoined(true);
    apply();
  }

  async function pick(track: Track) {
    const previous = sessionRef.current;
    setError(null);

    const optimistic: ListeningSession = {
      trackId: track.id,
      title: track.title,
      artist: track.artist,
      previewUrl: track.previewUrl,
      artworkUrl: track.artworkUrl,
      isPlaying: true,
      positionMs: 0,
      updatedAt: new Date(Date.now() + offsetRef.current).toISOString(),
    };

    joinedRef.current = true;
    setJoined(true);
    sessionRef.current = optimistic;
    setSession(optimistic);
    apply();

    setSearchOpen(false);
    setQuery("");
    setResults([]);

    const ok = await startListening(conversationId, track.id).catch(() => false);

    if (!ok) {
      setError("Couldn't start listening together.");
      sessionRef.current = previous;
      setSession(previous);
    }
  }

  async function togglePlay() {
    const audio = audioRef.current;
    const s = sessionRef.current;
    if (!audio || !s) return;

    const nextPlaying = !s.isPlaying;
    const seconds = joinedRef.current
      ? audio.currentTime
      : targetSeconds(s, durationOf(audio), offsetRef.current);
    const positionMs = Math.round(seconds * 1000);

    const optimistic: ListeningSession = {
      ...s,
      isPlaying: nextPlaying,
      positionMs,
      updatedAt: new Date(Date.now() + offsetRef.current).toISOString(),
    };

    setError(null);
    joinedRef.current = true;
    setJoined(true);
    sessionRef.current = optimistic;
    setSession(optimistic);
    apply();

    const ok = await setPlayback(conversationId, nextPlaying, positionMs).catch(
      () => false
    );
    if (!ok) setError("Couldn't update playback.");
  }

  async function end() {
    if (!window.confirm("End listening together?")) return;

    sessionRef.current = null;
    setSession(null);
    await stopListening(conversationId).catch(() => {});
  }

  const needsJoin = !!session && session.isPlaying && !joined;

  return (
    <>
      <audio ref={audioRef} loop preload="auto" />

      <div
        className="border-b px-4 py-2"
        style={{
          background: theme.panel,
          borderColor: theme.border,
          color: theme.text,
        }}
      >
        {!session ? (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex w-full items-center justify-center gap-2 py-0.5 text-sm font-medium"
            style={{ color: theme.accent }}
          >
            🎧 Listen together
          </button>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Art url={session.artworkUrl} size={36} />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{session.title}</p>
                <p className="truncate text-xs" style={{ color: theme.muted }}>
                  {session.artist}
                </p>
              </div>

              {needsJoin ? (
                <button
                  type="button"
                  onClick={join}
                  className="shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold"
                  style={{ background: theme.accent, color: theme.bg.startsWith("hsl") ? "#fff" : "#000" }}
                >
                  Join
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void togglePlay()}
                  aria-label={session.isPlaying ? "Pause" : "Play"}
                  className="shrink-0 px-2 text-xl"
                  style={{ color: theme.accent }}
                >
                  {session.isPlaying ? "❚❚" : "▶"}
                </button>
              )}

              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="shrink-0 text-xs font-medium"
                style={{ color: theme.accent }}
              >
                Change
              </button>
              <button
                type="button"
                onClick={() => void end()}
                className="shrink-0 text-xs font-medium text-red-500"
              >
                End
              </button>
            </div>

            <p className="text-[10px]" style={{ color: theme.muted }}>
              {needsJoin
                ? "Tap Join to hear it in sync."
                : "Playing together. A short preview loops for both of you."}
            </p>
          </div>
        )}

        {error && <p className="pt-1 text-xs text-red-500">{error}</p>}
      </div>

      {searchOpen && (
        <Sheet
          title="Pick a song to listen to together"
          tall
          onClose={() => setSearchOpen(false)}
        >
          <div className="space-y-3 pb-6">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search any song or artist"
              maxLength={80}
              autoFocus
              className="w-full rounded-full border bg-background px-4 py-2 text-sm"
            />

            {searching && (
              <p className="text-xs text-foreground/50">Searching...</p>
            )}

            {!searching && query.trim().length >= 2 && results.length === 0 && (
              <p className="text-xs text-foreground/50">No songs found.</p>
            )}

            {results.length > 0 && (
              <ul className="divide-y divide-foreground/10">
                {results.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => void pick(t)}
                      className="flex w-full items-center gap-3 py-2 text-left"
                    >
                      <Art url={t.artworkUrl} size={44} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {t.title}
                        </span>
                        <span className="block truncate text-xs text-foreground/50">
                          {t.artist}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <p className="text-[10px] text-foreground/40">
              Song previews provided by Apple.
            </p>
          </div>
        </Sheet>
      )}
    </>
  );
}