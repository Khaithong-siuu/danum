"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FILTERS,
  filterCss,
  kindOf,
  readVideoDuration,
  supportsCanvasFilter,
  type FilterId,
  type MediaKind,
} from "@/lib/media";
import { mmss } from "@/lib/reels";

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

export type PickedMedia = {
  id: string;
  file: File;
  kind: MediaKind;
  url: string;
  duration: number | null;
  filter: FilterId;
  caption: string;
};

type Options = {
  /** Which kinds of media this screen accepts */
  allow: MediaKind[];
  /** Most items that can be picked in one go */
  max: number;
  maxVideoSeconds?: number;
  maxVideoBytes?: number;
};

const MAX_RAW_PHOTO_BYTES = 40 * 1024 * 1024; // photos get shrunk on upload

export function useMediaItems({
  allow,
  max,
  maxVideoSeconds = 90,
  maxVideoBytes = 50 * 1024 * 1024,
}: Options) {
  const [items, setItems] = useState<PickedMedia[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  // Always revoke whatever is left when the screen closes
  const itemsRef = useRef<PickedMedia[]>([]);
  itemsRef.current = items;
  useEffect(() => {
    return () => {
      itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url));
    };
  }, []);

  const add = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setError(null);
      setReading(true);

      const accepted: PickedMedia[] = [];
      let problem: string | null = null;
      const room = Math.max(0, max - itemsRef.current.length);

      for (const file of files) {
        if (accepted.length >= room) {
          problem = `You can add up to ${max} at a time.`;
          break;
        }

        const kind = kindOf(file);
        if (!kind || !allow.includes(kind)) {
          problem = allow.includes("video")
            ? "Choose a photo or a video."
            : "Choose a photo. Stories are photos only.";
          continue;
        }

        if (kind === "photo" && file.size > MAX_RAW_PHOTO_BYTES) {
          problem = "That photo is too large.";
          continue;
        }

        const url = URL.createObjectURL(file);
        let duration: number | null = null;

        if (kind === "video") {
          if (file.size > maxVideoBytes) {
            problem = `Videos can be up to ${Math.round(maxVideoBytes / 1024 / 1024)} MB.`;
            URL.revokeObjectURL(url);
            continue;
          }
          const ext = (file.name.split(".").pop() || "").toLowerCase();
          if (!["mp4", "mov", "webm"].includes(ext)) {
            problem = "Choose an MP4, MOV or WebM video.";
            URL.revokeObjectURL(url);
            continue;
          }
          duration = await readVideoDuration(url);
          if (duration === null) {
            problem = "We couldn't read that video.";
            URL.revokeObjectURL(url);
            continue;
          }
          if (duration > maxVideoSeconds) {
            problem = `Reels can be up to ${maxVideoSeconds} seconds. Yours is ${duration}.`;
            URL.revokeObjectURL(url);
            continue;
          }
        }

        accepted.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          kind,
          url,
          duration,
          filter: "original",
          caption: "",
        });
      }

      if (accepted.length > 0) {
        setItems((prev) => [...prev, ...accepted]);
        setActiveId(accepted[0].id);
      }
      setError(problem);
      setReading(false);
    },
    [allow, max, maxVideoBytes, maxVideoSeconds]
  );

  const update = useCallback((id: string, patch: Partial<PickedMedia>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  const remove = useCallback((id: string) => {
    const gone = itemsRef.current.find((i) => i.id === id);
    if (gone) URL.revokeObjectURL(gone.url);
    const rest = itemsRef.current.filter((i) => i.id !== id);
    setItems(rest);
    setActiveId((current) =>
      current === id ? (rest[rest.length - 1]?.id ?? null) : current
    );
  }, []);

  const active = items.find((i) => i.id === activeId) ?? items[0] ?? null;

  return {
    items,
    active,
    setActiveId,
    add,
    update,
    remove,
    error,
    setError,
    reading,
  };
}

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

function Svg({
  children,
  className = "h-5 w-5",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const LibraryIcon = () => (
  <Svg>
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <circle cx="9" cy="9" r="1.6" />
    <path d="m21 15-4.5-4.5L8 19" />
  </Svg>
);
const CameraIcon = () => (
  <Svg>
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
    <circle cx="12" cy="13" r="3" />
  </Svg>
);
const RecordIcon = () => (
  <Svg>
    <rect x="2.5" y="6" width="13" height="12" rx="3" />
    <path d="m15.5 10.5 6-3.5v10l-6-3.5" />
  </Svg>
);
const PlayIcon = () => (
  <svg viewBox="0 0 24 24" className="ml-0.5 h-6 w-6" fill="currentColor" aria-hidden="true">
    <path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5z" />
  </svg>
);
const CloseIcon = ({ className = "h-3.5 w-3.5" }: { className?: string }) => (
  <Svg className={className}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </Svg>
);

/* ------------------------------------------------------------------ */
/* Pick buttons: gallery, camera, video camera                         */
/* ------------------------------------------------------------------ */

export function MediaActions({
  allow,
  multiple,
  disabled,
  onFiles,
}: {
  allow: MediaKind[];
  multiple: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
}) {
  const library = useRef<HTMLInputElement>(null);
  const photo = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLInputElement>(null);

  const canVideo = allow.includes("video");
  const libraryAccept = canVideo ? "image/*,video/*" : "image/*";

  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    // Reset so choosing the same file twice still fires
    e.target.value = "";
    if (files.length) onFiles(files);
  }

  const pill =
    "liquid flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl px-3 text-[13px] font-semibold transition active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50";

  return (
    <div className="flex gap-2">
      <input
        ref={library}
        type="file"
        accept={libraryAccept}
        multiple={multiple}
        onChange={handle}
        className="hidden"
        tabIndex={-1}
      />
      <input
        ref={photo}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handle}
        className="hidden"
        tabIndex={-1}
      />
      <input
        ref={video}
        type="file"
        accept="video/*"
        capture="environment"
        onChange={handle}
        className="hidden"
        tabIndex={-1}
      />

      <button
        type="button"
        disabled={disabled}
        onClick={() => library.current?.click()}
        className={`${pill} liquid-brand !text-white`}
      >
        <LibraryIcon />
        Library
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => photo.current?.click()}
        className={pill}
      >
        <CameraIcon />
        Camera
      </button>
      {canVideo && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => video.current?.click()}
          className={pill}
        >
          <RecordIcon />
          Record
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stage: big preview of the selected item                             */
/* ------------------------------------------------------------------ */

export function MediaStage({
  item,
  shape,
  caption,
  busy,
  onRemove,
}: {
  item: PickedMedia | null;
  /** post = 4:5 frame, story = full-height 9:16 frame */
  shape: "post" | "story";
  /** Shown as a glass chip near the bottom, the way stories display it */
  caption?: string;
  busy?: boolean;
  onRemove?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  // A new item starts paused
  useEffect(() => {
    setPlaying(false);
  }, [item?.id]);

  const frame =
    shape === "story"
      ? {
          aspectRatio: "9 / 16",
          width: "min(100%, calc(min(60dvh, 540px) * 9 / 16))",
        }
      : {
          aspectRatio: "4 / 5",
          width: "min(100%, calc(min(52dvh, 480px) * 4 / 5))",
        };

  function toggle() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
    } else {
      v.pause();
    }
  }

  return (
    <div
      className="relative mx-auto isolate overflow-hidden rounded-[32px] bg-black shadow-[0_24px_60px_-20px_rgba(0,0,0,0.55)] ring-1 ring-foreground/10"
      style={frame}
    >
      {!item ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[radial-gradient(120%_90%_at_50%_0%,hsl(var(--brand)/0.28),transparent_60%)] px-8 text-center text-white">
          <div className="liquid-media flex h-16 w-16 items-center justify-center rounded-[22px]">
            <LibraryIcon />
          </div>
          <p className="text-[15px] font-semibold tracking-tight">
            Pick from your gallery
          </p>
          <p className="text-xs text-white/60">
            {shape === "story"
              ? "Choose several to share a run of stories"
              : "Photos and videos both work"}
          </p>
        </div>
      ) : (
        <>
          {item.kind === "photo" ? (
            <>
              {/* Soft colour wash from the photo itself */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full scale-125 object-cover opacity-70 blur-3xl"
                style={{ filter: `blur(48px) ${filterCss(item.filter)}` }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={item.id}
                src={item.url}
                alt="Selected photo"
                className="relative h-full w-full object-contain animate-in fade-in-0 zoom-in-[0.98] duration-300"
                style={{ filter: filterCss(item.filter) }}
              />
            </>
          ) : (
            <>
              <video
                key={item.id}
                ref={videoRef}
                src={item.url}
                playsInline
                loop
                preload="metadata"
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                className="relative h-full w-full object-contain"
              />
              <button
                type="button"
                onClick={toggle}
                aria-label={playing ? "Pause" : "Play"}
                className="absolute inset-0 flex items-center justify-center"
              >
                <span
                  className={`liquid-media flex h-16 w-16 items-center justify-center rounded-full transition duration-200 ${
                    playing ? "scale-75 opacity-0" : "scale-100 opacity-100"
                  }`}
                >
                  <PlayIcon />
                </span>
              </button>
            </>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/45 to-transparent" />

          {/* Top-left: what this is */}
          <div className="liquid-media absolute left-3 top-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold">
            {item.kind === "video" ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                Reel{item.duration ? ` · ${mmss(item.duration)}` : ""}
              </>
            ) : shape === "story" ? (
              "Story"
            ) : (
              "Photo"
            )}
          </div>

          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              disabled={busy}
              aria-label="Remove"
              className="liquid-media absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full transition active:scale-90 disabled:opacity-50"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          )}

          {caption && (
            <div className="pointer-events-none absolute inset-x-0 bottom-4 px-4 text-center">
              <span className="liquid-media inline-block max-w-full rounded-full px-3.5 py-1.5 text-xs font-medium">
                {caption}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Filters (photos only)                                               */
/* ------------------------------------------------------------------ */

export function FilterStrip({
  item,
  onChange,
}: {
  item: PickedMedia | null;
  onChange: (id: FilterId) => void;
}) {
  const [supported, setSupported] = useState(false);
  useEffect(() => setSupported(supportsCanvasFilter()), []);

  if (!item || item.kind !== "photo" || !supported) return null;

  return (
    <div
      className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1"
      data-no-swipe="true"
      role="listbox"
      aria-label="Photo filters"
    >
      {FILTERS.map((f) => {
        const on = item.filter === f.id;
        return (
          <button
            key={f.id}
            type="button"
            role="option"
            aria-selected={on}
            onClick={() => onChange(f.id)}
            className="flex shrink-0 flex-col items-center gap-1.5 active:scale-95"
          >
            <span
              className={`relative block h-16 w-16 overflow-hidden rounded-2xl transition ${
                on
                  ? "ring-2 ring-brand ring-offset-2 ring-offset-background"
                  : "ring-1 ring-foreground/10"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt=""
                className="h-full w-full object-cover"
                style={{ filter: f.css }}
              />
            </span>
            <span
              className={`text-[11px] font-medium ${
                on ? "text-foreground" : "text-foreground/50"
              }`}
            >
              {f.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tray: everything picked this session                                */
/* ------------------------------------------------------------------ */

export function MediaTray({
  items,
  activeId,
  numbered,
  disabled,
  onSelect,
  onRemove,
}: {
  items: PickedMedia[];
  activeId: string | null;
  /** Show 1, 2, 3 badges (the order a queue will be shared in) */
  numbered?: boolean;
  disabled?: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  if (items.length < 2) return null;

  return (
    <div
      className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1"
      data-no-swipe="true"
    >
      {items.map((item, index) => {
        const on = item.id === activeId;
        return (
          <div key={item.id} className="relative shrink-0">
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              aria-label={`Select ${item.kind} ${index + 1}`}
              className={`relative block h-[72px] w-[72px] overflow-hidden rounded-2xl bg-black transition active:scale-95 ${
                on
                  ? "ring-2 ring-brand ring-offset-2 ring-offset-background"
                  : "opacity-70 ring-1 ring-foreground/10"
              }`}
            >
              {item.kind === "photo" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.url}
                  alt=""
                  className="h-full w-full object-cover"
                  style={{ filter: filterCss(item.filter) }}
                />
              ) : (
                <video
                  src={`${item.url}#t=0.1`}
                  preload="metadata"
                  muted
                  playsInline
                  className="h-full w-full object-cover"
                />
              )}
              {item.kind === "video" && item.duration ? (
                <span className="liquid-media absolute bottom-1 left-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                  {mmss(item.duration)}
                </span>
              ) : null}
              {numbered && (
                <span className="absolute left-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold text-white shadow">
                  {index + 1}
                </span>
              )}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onRemove(item.id)}
              aria-label="Remove from selection"
              className="liquid-media absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 disabled:opacity-50"
            >
              <CloseIcon className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
