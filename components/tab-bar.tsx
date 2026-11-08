"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t glass-bar pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_12px_-3px_hsl(var(--foreground)/0.06)] md:hidden"
    >
      <div className="mx-auto grid h-14 max-w-xl grid-cols-5 items-center">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const isNew = tab.name === "plus";

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
              className={`relative flex h-full flex-col items-center justify-center transition-all active:scale-90 ${
                active ? "text-brand" : "text-foreground/50 hover:text-foreground/80"
              }`}
            >
              {isNew ? (
                <span className="flex h-9 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand to-pink-500 text-white shadow-md shadow-brand/30 transition-transform hover:scale-105 active:scale-95">
                  <Icon name="plus" className="h-5 w-5" strokeWidth={2.6} />
                </span>
              ) : (
                <>
                  <Icon name={tab.name} strokeWidth={active ? 2.4 : 1.8} />
                  {active && (
                    <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-brand animate-pulse" />
                  )}
                </>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}