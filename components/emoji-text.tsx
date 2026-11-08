"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { emojiSources, splitEmoji } from "@/lib/emoji";

// Remembers which address worked (or that none did) for each emoji
const working = new Map<string, number>();

const noSubscribe = () => () => {};
// Apple devices already have Apple's emoji, so only everyone else gets pictures
const wantsImages = () =>
  !/iPhone|iPad|iPod|Macintosh|Mac OS X/.test(navigator.userAgent);
const serverValue = () => false;

function EmojiImg({ glyph }: { glyph: string }) {
  const sources = useMemo(() => emojiSources(glyph), [glyph]);
  const [index, setIndex] = useState(() => working.get(glyph) ?? 0);

  // No picture available: show the plain emoji from the system or the Noto font
  if (index >= sources.length) return <>{glyph}</>;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={sources[index]}
      alt={glyph}
      draggable={false}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onLoad={() => working.set(glyph, index)}
      onError={() => {
        const next = index + 1;
        if (next >= sources.length) working.set(glyph, next);
        setIndex(next);
      }}
      className="inline-block h-[1.2em] w-[1.2em] select-none align-[-0.2em]"
    />
  );
}

export function EmojiText({ text }: { text: string }) {
  const useImages = useSyncExternalStore(noSubscribe, wantsImages, serverValue);

  const parts = useMemo(
    () => (useImages ? splitEmoji(text) : null),
    [text, useImages]
  );

  if (!parts) return <>{text}</>;

  return (
    <>
      {parts.map((p, i) =>
        p.emoji ? <EmojiImg key={i} glyph={p.value} /> : p.value
      )}
    </>
  );
}