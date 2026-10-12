export type IconName =
  | "home"
  | "search"
  | "plus"
  | "bell"
  | "chat"
  | "reels"
  | "user"
  | "bookmark";

const SHAPES: Record<IconName, React.ReactNode> = {
  home: <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  bell: (
    <>
      <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </>
  ),
  chat: <path d="M5 5h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H10l-5 3.5V18a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />,
  reels: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4.5" />
      <path d="M10 8.5v7l6-3.5z" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </>
  ),
  bookmark: <path d="M7 4h10a1 1 0 0 1 1 1v16l-6-4-6 4V5a1 1 0 0 1 1-1z" />,
};

export function Icon({
  name,
  className = "h-6 w-6",
  strokeWidth = 1.8,
}: {
  name: IconName;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {SHAPES[name]}
    </svg>
  );
}