"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { AuthCard, AuthError, AUTH_INPUT, AUTH_SUBMIT } from "@/components/auth-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useState } from "react";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      // The url which will be included in the email. This URL needs to be configured in your redirect URLs in the Supabase dashboard at https://supabase.com/dashboard/project/_/auth/url-configuration
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if (error) throw error;
      setSuccess(true);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      {success ? (
        <AuthCard
          title="Check your email"
          description="If that address has a Danum account, a reset link is on its way."
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
      ) : (
        <AuthCard
          title="Reset your password"
          description="Enter your email and we'll send you a link to reset it."
          footer={
            <>
              Remembered it?{" "}
              <Link
                href="/auth/login"
                className="font-semibold text-brand hover:underline"
              >
                Log in
              </Link>
            </>
          }
        >
          <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={AUTH_INPUT}
              />
            </div>

            {error && <AuthError message={error} />}

            <button type="submit" disabled={isLoading} className={AUTH_SUBMIT}>
              {isLoading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        </AuthCard>
      )}
    </div>
  );
}