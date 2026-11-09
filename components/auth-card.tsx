import type { ReactNode } from "react";

/** Shared frame for the log in, sign up and password screens. */
export function AuthCard({
  title,
  description,
  footer,
  children,
}: {
  title: string;
  description?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="glass-card rounded-[28px] p-6 sm:p-8">
      <div className="mb-6 text-center">
        <h1 className="text-[26px] font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1.5 text-sm leading-snug text-foreground/55">
            {description}
          </p>
        )}
      </div>

      {children}

      {footer && (
        <div className="mt-6 text-center text-sm text-foreground/60">
          {footer}
        </div>
      )}
    </div>
  );
}

export function AuthError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-600"
    >
      {message}
    </p>
  );
}

export const AUTH_INPUT = "h-11 rounded-xl text-base";

export const AUTH_SUBMIT =
  "flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand text-[15px] font-semibold text-white shadow-lg shadow-brand/25 transition-all hover:opacity-95 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";