"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { ACCENTS, ACCENT_COOKIE, isAccent, type AccentKey } from "@/lib/theme";

const ICON_PROPS = {
  viewBox: "0 0 24 24",
  className: "h-4 w-4",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const MODES = [
  {
    value: "light",
    label: "Light",
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    ),
  },
  {
    value: "dark",
    label: "Dark",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
      </svg>
    ),
  },
  {
    value: "system",
    label: "System",
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </svg>
    ),
  },
];

export function ThemeSettings() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [accent, setAccent] = useState<AccentKey>("blue");

  useEffect(() => {
    setMounted(true);
    const current = document.documentElement.dataset.accent;
    if (isAccent(current)) setAccent(current);
  }, []);

  function chooseAccent(key: AccentKey) {
    setAccent(key);
    document.documentElement.dataset.accent = key;
    document.cookie = `${ACCENT_COOKIE}=${key}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-semibold">Appearance</p>
        <div className="grid grid-cols-3 rounded-2xl bg-foreground/[0.06] p-1">
          {MODES.map((mode) => {
            const active = mounted && theme === mode.value;
            return (
              <button
                key={mode.value}
                type="button"
                onClick={() => setTheme(mode.value)}
                className={`flex items-center justify-center gap-1.5 rounded-[14px] py-2 text-sm font-medium transition-all active:scale-95 ${
                  active
                    ? "bg-background text-foreground shadow-sm ring-1 ring-foreground/[0.06]"
                    : "text-foreground/55 hover:text-foreground"
                }`}
              >
                {mode.icon}
                {mode.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-foreground/50">
          System follows your device&apos;s light or dark setting.
        </p>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">Accent color</p>
        <div className="flex gap-3">
          {ACCENTS.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => chooseAccent(a.key)}
              aria-label={`${a.label} accent`}
              title={a.label}
              className={`h-9 w-9 rounded-full transition-all duration-200 active:scale-95 ${
                accent === a.key
                  ? "scale-105 ring-2 ring-foreground ring-offset-2 ring-offset-background"
                  : "opacity-80 hover:scale-105 hover:opacity-100"
              }`}
            >
              {/* data-accent makes this swatch use its own --brand value */}
              <span
                data-accent={a.key}
                className="block h-full w-full rounded-full bg-brand"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
