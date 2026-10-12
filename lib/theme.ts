export const ACCENT_COOKIE = "danum-accent";

export const ACCENTS = [
  { key: "blue", label: "Blue" },
  { key: "rose", label: "Rose" },
  { key: "green", label: "Green" },
  { key: "orange", label: "Orange" },
  { key: "purple", label: "Purple" },
] as const;

export type AccentKey = (typeof ACCENTS)[number]["key"];

export const DEFAULT_ACCENT: AccentKey = "blue";

export function isAccent(value: string | undefined | null): value is AccentKey {
  return ACCENTS.some((a) => a.key === value);
}