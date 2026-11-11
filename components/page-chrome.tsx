import type { ReactNode } from "react";
import Link from "next/link";

/** "‹ Feed" style link at the top of a page. */
export function BackLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="-ml-3 inline-flex min-h-11 items-center gap-0.5 rounded-full pl-3 pr-4 text-[16px] font-medium text-brand transition active:opacity-60"
    >
      <svg
        viewBox="0 0 24 24"
        className="-ml-0.5 h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
      {children}
    </Link>
  );
}

/** Big page heading, same size everywhere. */
export function PageTitle({
  children,
  subtitle,
}: {
  children: ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="mb-5 mt-1">
      <h1 className="text-[30px] font-bold leading-tight tracking-tight sm:text-[34px]">
        {children}
      </h1>
      {subtitle && (
        <p className="mt-1 text-sm text-foreground/55">{subtitle}</p>
      )}
    </div>
  );
}

/** Small spinner shown while a page loads. */
export function PageLoading() {
  return (
    <div className="flex justify-center py-24" role="status" aria-label="Loading">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-foreground/15 border-t-brand" />
    </div>
  );
}

/** Heading above a group of rows: "NEW", "EARLIER", "RESULTS". */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2.5 px-1 text-[13px] font-semibold uppercase tracking-wider text-foreground/45">
      {children}
    </p>
  );
}
