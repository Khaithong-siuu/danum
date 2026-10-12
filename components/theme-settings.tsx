"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { ACCENTS, ACCENT_COOKIE, isAccent, type AccentKey } from "@/lib/theme";

const MODES = [
  { value: "light", label: "☀️ Light" },
  { value: "dark", label: "🌙 Dark" },
  { value: "system", label: "💻 System" },
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
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium mb-2">Mode</p>
        <div className="grid grid-cols-3 gap-2">
          {MODES.map((mode) => {
            const active = mounted && theme === mode.value;
            return (
              <button
                key={mode.value}
                type="button"
                onClick={() => setTheme(mode.value)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "border-brand text-brand bg-foreground/5"
                    : "border-foreground/15 hover:bg-foreground/5"
                }`}
              >
                {mode.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-xs text-foreground/50">
          System follows your device&apos;s light or dark setting.
        </p>
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Accent color</p>
        <div className="flex gap-3">
          {ACCENTS.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => chooseAccent(a.key)}
              aria-label={`${a.label} accent`}
              title={a.label}
              className={`h-9 w-9 rounded-full transition ${
                accent === a.key
                  ? "ring-2 ring-offset-2 ring-foreground ring-offset-background"
                  : "hover:scale-110"
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