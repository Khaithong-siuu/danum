import Image from "next/image";
import Link from "next/link";

/** The Danum logo and wordmark, used in every top bar. */
export function SiteLogo() {
  return (
    <Link
      href="/"
      aria-label="Danum home"
      className="flex items-center gap-2 transition active:opacity-70"
    >
      <Image
        src="/danum-logo.png"
        alt=""
        width={28}
        height={28}
        priority
        className="h-7 w-7 rounded-[9px]"
      />
      <span className="text-[22px] font-extrabold tracking-tight">Danum</span>
    </Link>
  );
}
