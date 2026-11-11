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

type Step = "email" | "code" | "password";

/**
 * Reset a forgotten password with an emailed code:
 *   1. enter your email
 *   2. enter the 6-digit code (this also logs you in)
 *   3. choose a new password
 */
export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  async function sendCode(): Promise<string | null> {
    const supabase = createClient();
    // Supabase doesn't say whether the address has an account, which is fine:
    // we always move on to the code screen.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });
    return error ? error.message : null;
  }

  async function verifyCode(token: string): Promise<string | null> {
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "recovery",
    });
    if (error) {
      return "That code didn't work. It may have expired, so ask for a new one.";
    }
    setStep("password");
    return null;
  }

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const problem = await sendCode();
    setIsLoading(false);

    if (problem) {
      setError(problem);
      return;
    }
    setStep("code");
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      router.push("/");
      router.refresh();
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
          buttonLabel="Continue"
          onVerify={verifyCode}
          onResend={sendCode}
          onBack={() => {
            setStep("email");
            setError(null);
          }}
        />
      </div>
    );
  }

  if (step === "password") {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <AuthCard
          title="Choose a new password"
          description="Pick something you haven't used before."
        >
          <form onSubmit={handlePassword} className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                placeholder="New password"
                required
                minLength={6}
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={AUTH_INPUT}
              />
            </div>

            {error && <AuthError message={error} />}

            <button type="submit" disabled={isLoading} className={AUTH_SUBMIT}>
              {isLoading ? "Saving…" : "Save new password"}
            </button>
          </form>
        </AuthCard>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <AuthCard
        title="Reset your password"
        description="Enter your email and we'll send you a code to reset it."
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
        <form onSubmit={handleEmail} className="flex flex-col gap-4">
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
            {isLoading ? "Sending…" : "Send code"}
          </button>
        </form>
      </AuthCard>
    </div>
  );
}
