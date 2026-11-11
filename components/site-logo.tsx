import Link from "next/link";

/** The Danum wordmark, used in every top bar. */
export function SiteLogo() {
  return (
    <Link
      href="/"
      aria-label="Danum home"
      className="text-[24px] font-extrabold tracking-tight transition active:opacity-70"
    >
      Danum
    </Link>
  );
}
