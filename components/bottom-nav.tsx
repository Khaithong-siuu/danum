"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomNav() {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Home", icon: "🏠" },
    { href: "/create", label: "Create", icon: "➕" },
    { href: "/profile", label: "Profile", icon: "👤" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-foreground/10 bg-background/95 backdrop-blur-md md:hidden">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center gap-1 text-xs ${
                isActive ? "text-blue-500 font-semibold" : "text-foreground/60"
              }`}
            >
              <span className="text-xl">{link.icon}</span>
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}