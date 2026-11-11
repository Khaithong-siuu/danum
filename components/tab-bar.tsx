"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";

const TABS: {
  href: string;
  name: IconName;
  label: string;
  match: (path: string) => boolean;
}[] = [
  { href: "/", name: "home", label: "Home", match: (p) => p === "/" },
  { href: "/search", name: "search", label: "Search", match: (p) => p.startsWith("/search") },
  { href: "/reels/new", name: "plus", label: "New post", match: (p) => p === "/reels/new" },
  {
    href: "/reels",
    name: "reels",
    label: "Reels",
    match: (p) => p === "/reels" || (p.startsWith("/reels/") && p !== "/reels/new"),
  },
  { href: "/profile", name: "user", label: "Profile", match: (p) => p.startsWith("/profile") },
];

const SLOT = 56; // px, width of one tab
const PAD = 6; // px, padding inside the pill
const NEW_INDEX = 2;

// Pages that swipe left / right between each other (Reels and New post
// are left out on purpose: Reels has its own gestures, New post is an action)
const SWIPE_ORDER = ["/", "/search", "/profile"];

function isWide(el: HTMLElement | null) {
  // Is this element (or a parent) a sideways scroller? Then leave the swipe to it.
  for (let n: HTMLElement | null = el; n && n !== document.body; n = n.parentElement) {
    if (n.dataset.noSwipe !== undefined) return true;
    const tag = n.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "VIDEO" || tag === "SELECT") return true;
    if (n.getAttribute("role") === "dialog") return true;
    const ox = getComputedStyle(n).overflowX;
    if ((ox === "auto" || ox === "scroll") && n.scrollWidth > n.clientWidth + 2) return true;
  }
  return false;
}

/**
 * Floating glass tab bar with a "liquid" bubble.
 * - The bubble glides to the tab you pick, with a little spring.
 * - Press and drag along the bar: the bubble follows your finger and
 *   lands on the tab you let go over.
 * - On Home, Search and Profile you can also swipe the page left or
 *   right to move to the next tab.
 * Lives in the root layout, so the bubble keeps its place between pages.
 */
export function TabBar() {
  const pathname = usePathname();
  const router = useRouter();

  const activeIndex = TABS.findIndex((t) => t.match(pathname));
  const visible = activeIndex !== -1 && pathname !== "/reels" && !pathname.startsWith("/reels/saved");

  const [dragX, setDragX] = useState<number | null>(null); // bubble position while dragging
  const [pending, setPending] = useState<number | null>(null); // where we're heading
  const barRef = useRef<HTMLDivElement>(null);
  const press = useRef<{ startX: number; moved: boolean } | null>(null);

  // Once the new page is in, stop waiting
  useEffect(() => {
    setPending(null);
  }, [pathname]);

  function indexFromX(clientX: number) {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const x = clientX - rect.left - PAD - SLOT / 2;
    return Math.min(TABS.length - 1, Math.max(0, Math.round(x / SLOT)));
  }

  function bubbleX(clientX: number) {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const x = clientX - rect.left - PAD - SLOT / 2;
    return Math.min((TABS.length - 1) * SLOT, Math.max(0, x));
  }

  function go(index: number) {
    const tab = TABS[index];
    if (!tab) return;
    if (tab.match(pathname)) return;
    setPending(index);
    router.push(tab.href);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    press.current = { startX: e.clientX, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragX(bubbleX(e.clientX));
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const p = press.current;
    if (!p) return;
    if (Math.abs(e.clientX - p.startX) > 4) p.moved = true;
    setDragX(bubbleX(e.clientX));
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!press.current) return;
    press.current = null;
    setDragX(null);
    go(indexFromX(e.clientX));
  }

  function onPointerCancel() {
    press.current = null;
    setDragX(null);
  }

  // Swipe the page sideways to change tab
  useEffect(() => {
    if (!visible) return;
    const order = SWIPE_ORDER;
    const here = order.findIndex((p) => (p === "/" ? pathname === "/" : pathname.startsWith(p)));
    if (here === -1) return;

    let start: { x: number; y: number; t: number } | null = null;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      start = e.touches.length === 1 && !isWide(e.target as HTMLElement)
        ? { x: t.clientX, y: t.clientY, t: Date.now() }
        : null;
    };
    const onEnd = (e: TouchEvent) => {
      if (!start) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      const dt = Date.now() - start.t;
      start = null;
      if (Math.abs(dx) < 80 || Math.abs(dy) > 45 || Math.abs(dx) < Math.abs(dy) * 2 || dt > 600) return;

      const next = order[here + (dx < 0 ? 1 : -1)];
      if (!next) return;
      const i = TABS.findIndex((tab) => tab.href === next);
      setPending(i);
      router.push(next);
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchend", onEnd);
    };
  }, [visible, pathname, router]);

  if (!visible) return null;

  const dragging = dragX !== null;
  const hover = dragging ? indexFromXFromBubble(dragX) : null;
  const lit = hover ?? pending ?? activeIndex;
  const bubbleHidden = lit === NEW_INDEX;
  const x = dragging ? dragX : lit * SLOT;

  return (
    <>
      {(pathname.startsWith("/search") || pathname === "/reels/new") && (
        <div aria-hidden="true" className="h-28 md:hidden" />
      )}

      <nav
        aria-label="Main"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:hidden"
      >
        <div
          ref={barRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          style={{ width: SLOT * TABS.length + PAD * 2, padding: PAD, touchAction: "none" }}
          className="glass-surface pointer-events-auto relative flex select-none items-center rounded-full border border-foreground/[0.08] shadow-[0_10px_40px_-8px_rgba(0,0,0,0.35)]"
        >
          {/* The glass bubble */}
          <span
            aria-hidden="true"
            className={`absolute left-[6px] top-[6px] h-11 rounded-full border border-white/20 bg-foreground/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_6px_18px_-4px_rgba(0,0,0,0.35)] backdrop-blur-md motion-reduce:transition-none ${
              dragging
                ? "scale-[1.12]"
                : "transition-transform duration-[420ms] ease-[cubic-bezier(0.34,1.45,0.5,1)]"
            } ${bubbleHidden ? "opacity-0" : "opacity-100"}`}
            style={{
              width: SLOT,
              transform: `translateX(${x}px)${dragging ? " scale(1.12)" : ""}`,
              transition: dragging ? "opacity 0.15s" : undefined,
            }}
          />

          {TABS.map((tab, i) => {
            const isNew = i === NEW_INDEX;
            const on = lit === i;

            return (
              <button
                key={tab.href}
                type="button"
                aria-label={tab.label}
                aria-current={activeIndex === i ? "page" : undefined}
                onClick={(e) => {
                  // Touch and mouse are handled by the bar; this is for the keyboard
                  if (e.detail === 0) go(i);
                }}
                style={{ width: SLOT }}
                className="relative z-10 flex h-11 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
              >
                {isNew ? (
                  <span
                    className={`flex h-10 w-12 items-center justify-center rounded-full bg-gradient-to-tr from-brand to-fuchsia-500 text-white shadow-md shadow-brand/30 transition-transform duration-200 ${
                      on ? "scale-110" : ""
                    }`}
                  >
                    <Icon name="plus" className="h-5 w-5" strokeWidth={2.6} />
                  </span>
                ) : (
                  <Icon
                    name={tab.name}
                    className={`h-6 w-6 transition-colors duration-200 ${
                      on ? "text-brand" : "text-foreground/50"
                    }`}
                    strokeWidth={on ? 2.3 : 1.8}
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );

  function indexFromXFromBubble(bx: number) {
    return Math.min(TABS.length - 1, Math.max(0, Math.round(bx / SLOT)));
  }
}
