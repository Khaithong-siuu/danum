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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-foreground/10 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
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
              className={`flex h-full items-center justify-center transition active:scale-90 ${
                active ? "text-foreground" : "text-foreground/50"
              }`}
            >
              {isNew ? (
                <span className="flex h-8 w-11 items-center justify-center rounded-xl bg-brand text-white">
                  <Icon name="plus" className="h-5 w-5" strokeWidth={2.4} />
                </span>
              ) : (
                <Icon name={tab.name} strokeWidth={active ? 2.4 : 1.8} />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}