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

/** A floating glass bar, like the one on iPhone. */
export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-6 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:hidden"
    >
      <div className="glass-surface pointer-events-auto flex w-full max-w-xs items-center justify-between rounded-full border border-foreground/[0.08] p-1.5 shadow-[0_10px_40px_-8px_rgba(0,0,0,0.35)]">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const isNew = tab.name === "plus";

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
              className={`flex items-center justify-center rounded-full transition-all duration-200 active:scale-90 ${
                isNew
                  ? "h-11 w-14 bg-gradient-to-tr from-brand to-fuchsia-500 text-white shadow-md shadow-brand/30"
                  : `h-11 w-11 ${
                      active
                        ? "bg-brand/15 text-brand"
                        : "text-foreground/50 hover:text-foreground/80"
                    }`
              }`}
            >
              <Icon
                name={tab.name}
                className={isNew ? "h-5 w-5" : "h-6 w-6"}
                strokeWidth={isNew ? 2.6 : active ? 2.3 : 1.8}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
