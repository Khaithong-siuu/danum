"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { AuthCard, AuthError, AUTH_INPUT, AUTH_SUBMIT } from "@/components/auth-card";
import { EmailCodeStep } from "@/components/email-code-step";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Mode = "code" | "password";

/** Supabase says this when the email has no account and sign-ups are off for codes. */
function isUnknownEmail(error: { message?: string; code?: string }) {
  return (
    error.code === "otp_disabled" ||
    error.code === "user_not_found" ||
    /signups? not allowed|user not found/i.test(error.message ?? "")
  );
}

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [mode, setMode] = useState<Mode>("code");
  const [step, setStep] = useState<"form" | "code">("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Asks Supabase to email a code. Returns an error message, or null.
  // Log in never creates an account: that's what Sign up is for.
  async function sendCode(): Promise<string | null> {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });

    // Don't reveal whether an email has an account: carry on to the code
    // screen either way. Real problems (like rate limits) are still shown.
    if (error && !isUnknownEmail(error)) return error.message;
    return null;
  }

  async function verifyCode(token: string): Promise<string | null> {
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });
    if (error) {
      return "That code didn't work. It may have expired, so ask for a new one.";
    }
    router.push("/");
    router.refresh();
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (mode === "code") {
        const problem = await sendCode();
        if (problem) throw new Error(problem);
        setStep("code");
      } else {
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/");
        router.refresh();
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  if (step === "code") {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <EmailCodeStep
          email={email}
          title="Check your email"
          buttonLabel="Log in"
          onVerify={verifyCode}
          onResend={sendCode}
          onBack={() => {
            setStep("form");
            setError(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <AuthCard
        title="Welcome back"
        description={
          mode === "code"
            ? "We'll email you a code to log in. No password needed."
            : "Log in to keep sharing your moments."
        }
        footer={
          <>
            New to Danum?{" "}
            <Link
              href="/auth/sign-up"
              className="font-semibold text-brand hover:underline"
            >
              Create an account
            </Link>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

          {mode === "password" && (
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/auth/forgot-password"
                  className="-my-2 ml-auto py-2 text-sm text-foreground/55 transition-colors hover:text-brand"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={AUTH_INPUT}
              />
            </div>
          )}

          {error && <AuthError message={error} />}

          <button type="submit" disabled={isLoading} className={AUTH_SUBMIT}>
            {mode === "code"
              ? isLoading
                ? "Sending code…"
                : "Email me a code"
              : isLoading
                ? "Logging in…"
                : "Log in"}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "code" ? "password" : "code");
              setError(null);
            }}
            className="min-h-11 text-sm font-medium text-foreground/60 transition-colors hover:text-brand"
          >
            {mode === "code" ? "Use my password instead" : "Email me a code instead"}
          </button>
        </form>
      </AuthCard>
    </div>
  );
}
