export type ChatThemeKey =
  | "default"
  | "midnight"
  | "sunset"
  | "ocean"
  | "forest"
  | "candy"
  | "aurora"
  | "mono";

export type ChatTheme = {
  key: ChatThemeKey;
  label: string;
  swatch: string; // preview circle in the picker
  bg: string; // chat background
  panel: string; // header and input bar
  text: string;
  muted: string;
  border: string;
  input: string;
  mine: string; // your bubbles
  mineText: string;
  theirs: string; // their bubbles
  theirsText: string;
  accent: string;
};

export const CHAT_THEMES: ChatTheme[] = [
  {
    key: "default",
    label: "Default",
    swatch: "linear-gradient(135deg, #d4d4d8, #3b82f6)",
    bg: "hsl(var(--background))",
    panel: "hsl(var(--background) / 0.92)",
    text: "hsl(var(--foreground))",
    muted: "hsl(var(--foreground) / 0.5)",
    border: "hsl(var(--foreground) / 0.1)",
    input: "hsl(var(--background))",
    mine: "hsl(var(--brand))",
    mineText: "#ffffff",
    theirs: "hsl(var(--foreground) / 0.1)",
    theirsText: "hsl(var(--foreground))",
    accent: "hsl(var(--brand))",
  },
  {
    key: "midnight",
    label: "Midnight",
    swatch: "linear-gradient(135deg, #0b1020, #6366f1)",
    bg: "linear-gradient(180deg, #0b1020, #151a33)",
    panel: "rgba(15, 18, 36, 0.88)",
    text: "#f1f2ff",
    muted: "rgba(241, 242, 255, 0.55)",
    border: "rgba(255, 255, 255, 0.1)",
    input: "rgba(255, 255, 255, 0.08)",
    mine: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    mineText: "#ffffff",
    theirs: "#232846",
    theirsText: "#e8eaff",
    accent: "#a5b4fc",
  },
  {
    key: "sunset",
    label: "Sunset",
    swatch: "linear-gradient(135deg, #ffb27a, #ff3d77)",
    bg: "linear-gradient(180deg, #fff1e6, #ffd9d0)",
    panel: "rgba(255, 241, 230, 0.9)",
    text: "#3b1d1d",
    muted: "rgba(59, 29, 29, 0.55)",
    border: "rgba(59, 29, 29, 0.1)",
    input: "rgba(255, 255, 255, 0.85)",
    mine: "linear-gradient(135deg, #ff7a59, #ff3d77)",
    mineText: "#ffffff",
    theirs: "rgba(255, 255, 255, 0.85)",
    theirsText: "#3b1d1d",
    accent: "#e11d63",
  },
  {
    key: "ocean",
    label: "Ocean",
    swatch: "linear-gradient(135deg, #7dd3fc, #2563eb)",
    bg: "linear-gradient(180deg, #e0f7fa, #b3e5fc)",
    panel: "rgba(224, 247, 250, 0.9)",
    text: "#0c2a3b",
    muted: "rgba(12, 42, 59, 0.55)",
    border: "rgba(12, 42, 59, 0.1)",
    input: "rgba(255, 255, 255, 0.85)",
    mine: "linear-gradient(135deg, #0ea5e9, #2563eb)",
    mineText: "#ffffff",
    theirs: "rgba(255, 255, 255, 0.88)",
    theirsText: "#0c2a3b",
    accent: "#0284c7",
  },
  {
    key: "forest",
    label: "Forest",
    swatch: "linear-gradient(135deg, #86efac, #15803d)",
    bg: "linear-gradient(180deg, #e8f5e9, #c8e6c9)",
    panel: "rgba(232, 245, 233, 0.9)",
    text: "#0f2a17",
    muted: "rgba(15, 42, 23, 0.55)",
    border: "rgba(15, 42, 23, 0.1)",
    input: "rgba(255, 255, 255, 0.85)",
    mine: "linear-gradient(135deg, #22c55e, #15803d)",
    mineText: "#ffffff",
    theirs: "rgba(255, 255, 255, 0.88)",
    theirsText: "#0f2a17",
    accent: "#15803d",
  },
  {
    key: "candy",
    label: "Candy",
    swatch: "linear-gradient(135deg, #f9a8d4, #a855f7)",
    bg: "linear-gradient(180deg, #fdf2f8, #f5d0fe)",
    panel: "rgba(253, 242, 248, 0.9)",
    text: "#3b0a3b",
    muted: "rgba(59, 10, 59, 0.55)",
    border: "rgba(59, 10, 59, 0.1)",
    input: "rgba(255, 255, 255, 0.85)",
    mine: "linear-gradient(135deg, #ec4899, #a855f7)",
    mineText: "#ffffff",
    theirs: "rgba(255, 255, 255, 0.88)",
    theirsText: "#3b0a3b",
    accent: "#c026d3",
  },
  {
    key: "aurora",
    label: "Aurora",
    swatch: "linear-gradient(135deg, #2c5364, #34d399)",
    bg: "linear-gradient(160deg, #0f2027, #203a43, #2c5364)",
    panel: "rgba(15, 32, 39, 0.88)",
    text: "#e6fffb",
    muted: "rgba(230, 255, 251, 0.55)",
    border: "rgba(255, 255, 255, 0.12)",
    input: "rgba(255, 255, 255, 0.1)",
    mine: "linear-gradient(135deg, #34d399, #06b6d4)",
    mineText: "#042f2e",
    theirs: "rgba(255, 255, 255, 0.14)",
    theirsText: "#e6fffb",
    accent: "#5eead4",
  },
  {
    key: "mono",
    label: "Mono",
    swatch: "linear-gradient(135deg, #000000, #ffffff)",
    bg: "#000000",
    panel: "rgba(0, 0, 0, 0.88)",
    text: "#ffffff",
    muted: "rgba(255, 255, 255, 0.5)",
    border: "rgba(255, 255, 255, 0.12)",
    input: "#1c1c1e",
    mine: "#ffffff",
    mineText: "#000000",
    theirs: "#1c1c1e",
    theirsText: "#ffffff",
    accent: "#ffffff",
  },
];

export function isChatTheme(value: unknown): value is ChatThemeKey {
  return CHAT_THEMES.some((t) => t.key === value);
}

export function getChatTheme(key: unknown): ChatTheme {
  return CHAT_THEMES.find((t) => t.key === key) ?? CHAT_THEMES[0];
}