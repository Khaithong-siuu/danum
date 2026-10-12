"use client";

import { useEffect, useRef, useState } from "react";
import type { Track } from "@/lib/music";
import { MAX_PREVIEW_SECONDS, MIN_CLIP_SECONDS, mmss } from "@/lib/reels";

export type MusicChoice = { track: Track; start: number; length: number };

function Art({ url }: { url: string | null }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      referrerPolicy="no-referrer"
      className="h-10 w-10 shrink-0 rounded-md object-cover"
    />
  ) : (
    <div className="h-10 w-10 shrink-0 rounded-md bg-foreground/10" />
  );
}

export function MusicPicker({
  search,
  value,
  onChange,
}: {
  search: (query: string) => Promise<Track[]>;
  value: MusicChoice | null;
  onChange: (value: MusicChoice | null) => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const latest = useRef("");

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  function stop() {
    audioRef.current?.pause();
    setPlayingKey(null);
  }

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
      search(q)
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
  }, [query, search]);

  function playRow(track: Track) {
    const audio = audioRef.current;
    if (!audio) return;

    const key = `row:${track.id}`;
    if (playingKey === key) {
      stop();
      return;
    }

    audio.src = track.previewUrl;
    audio.currentTime = 0;
    void audio.play().catch(() => {});
    setPlayingKey(key);
  }

  function playClip() {
    const audio = audioRef.current;
    if (!audio || !value) return;

    if (playingKey === "clip") {
      stop();
      return;
    }

    audio.src = value.track.previewUrl;
    audio.currentTime = value.start;
    void audio.play().catch(() => {});
    setPlayingKey("clip");
  }

  function onTimeUpdate() {
    const audio = audioRef.current;
    if (
      audio &&
      value &&
      playingKey === "clip" &&
      audio.currentTime >= value.start + value.length
    ) {
      stop();
    }
  }

  function choose(track: Track) {
    stop();
    onChange({ track, start: 0, length: 15 });
    setOpen(false);
    setQuery("");
    setResults([]);
  }

  function setLength(length: number) {
    if (!value) return;
    stop();
    onChange({
      ...value,
      length,
      start: Math.min(value.start, MAX_PREVIEW_SECONDS - length),
    });
  }

  function setStart(start: number) {
    if (!value) return;
    stop();
    onChange({ ...value, start });
  }

  return (
    <div className="space-y-3 rounded-xl border border-foreground/10 p-4">
      <audio ref={audioRef} onTimeUpdate={onTimeUpdate} onEnded={stop} />

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">♪ Music (optional)</p>
        {value && (
          <button
            type="button"
            onClick={() => {
              stop();
              onChange(null);
            }}
            className="text-xs font-medium text-red-500"
          >
            Remove
          </button>
        )}
      </div>

      {/* Chosen song */}
      {value && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Art url={value.track.artworkUrl} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{value.track.title}</p>
              <p className="truncate text-xs text-foreground/50">
                {value.track.artist}
              </p>
            </div>
          </div>

          <label className="block text-sm">
            <span className="flex justify-between">
              <span>Clip length</span>
              <span className="text-foreground/50">{value.length}s</span>
            </span>
            <input
              type="range"
              min={MIN_CLIP_SECONDS}
              max={MAX_PREVIEW_SECONDS}
              value={value.length}
              onChange={(e) => setLength(Number(e.target.value))}
              className="w-full"
            />
          </label>

          <label className="block text-sm">
            <span className="flex justify-between">
              <span>Starts at</span>
              <span className="text-foreground/50">
                {mmss(value.start)} – {mmss(value.start + value.length)}
              </span>
            </span>
            <input
              type="range"
              min={0}
              max={MAX_PREVIEW_SECONDS - value.length}
              value={Math.min(value.start, MAX_PREVIEW_SECONDS - value.length)}
              onChange={(e) => setStart(Number(e.target.value))}
              disabled={value.length >= MAX_PREVIEW_SECONDS}
              className="w-full"
            />
          </label>

          <button
            type="button"
            onClick={playClip}
            className="w-full rounded-xl bg-foreground/10 py-2 text-sm font-medium"
          >
            {playingKey === "clip" ? "■ Stop preview" : "▶ Preview clip"}
          </button>
        </div>
      )}

      {/* Add music */}
      {!value && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-xl bg-foreground/10 py-2 text-sm font-medium"
        >
          Add music
        </button>
      )}

      {!value && open && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search any song or artist"
              maxLength={80}
              autoFocus
              className="min-w-0 flex-1 rounded-full border bg-background px-4 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                stop();
                setOpen(false);
              }}
              className="px-2 text-sm text-foreground/60"
            >
              Cancel
            </button>
          </div>

          {searching && (
            <p className="text-xs text-foreground/50">Searching...</p>
          )}

          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <p className="text-xs text-foreground/50">No songs found.</p>
          )}

          {results.length > 0 && (
            <ul className="max-h-64 divide-y divide-foreground/10 overflow-y-auto">
              {results.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2">
                  <button
                    type="button"
                    onClick={() => playRow(t)}
                    aria-label={`Play a preview of ${t.title}`}
                    className="relative shrink-0"
                  >
                    <Art url={t.artworkUrl} />
                    <span className="absolute inset-0 flex items-center justify-center rounded-md bg-black/40 text-xs text-white">
                      {playingKey === `row:${t.id}` ? "■" : "▶"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => choose(t)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-sm font-medium">
                      {t.title}
                    </span>
                    <span className="block truncate text-xs text-foreground/50">
                      {t.artist}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="text-[10px] text-foreground/40">
            Song previews provided by Apple. Clips can be up to 30 seconds.
          </p>
        </div>
      )}
    </div>
  );
}