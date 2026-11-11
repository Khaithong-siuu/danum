import Link from "next/link";
import { AuthCard } from "@/components/auth-card";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <AuthCard
          title="Check your email"
          description="We sent you a link to confirm your account. Open it, then log in."
          footer={
            <Link
              href="/auth/login"
              className="font-semibold text-brand hover:underline"
            >
              Back to log in
            </Link>
          }
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-brand">
            <svg
              viewBox="0 0 24 24"
              className="h-7 w-7"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="5" width="18" height="14" rx="3" />
              <path d="m4 7 8 6 8-6" />
            </svg>
          </div>
        </AuthCard>
      </div>
    </div>
  );
}
