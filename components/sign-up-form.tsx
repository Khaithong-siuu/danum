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

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"form" | "code">("form");
  const router = useRouter();

  async function verifyCode(token: string): Promise<string | null> {
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "signup",
    });
    if (error) {
      return "That code didn't work. It may have expired, so ask for a new one.";
    }
    router.push("/");
    router.refresh();
    return null;
  }

  async function resendCode(): Promise<string | null> {
    const supabase = createClient();
    const { error } = await supabase.auth.resend({ type: "signup", email });
    return error ? error.message : null;
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    if (password !== repeatPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;

      // If email confirmation is switched off in Supabase you're already in
      if (data.session) {
        router.push("/");
        router.refresh();
        return;
      }

      // Otherwise Supabase has emailed a code to confirm the address
      setStep("code");
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
          title="Confirm your email"
          buttonLabel="Confirm and continue"
          onVerify={verifyCode}
          onResend={resendCode}
          onBack={() => setStep("form")}
        />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <AuthCard
        title="Join Danum"
        description="Create an account to share your moments."
        footer={
          <>
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="font-semibold text-brand hover:underline"
            >
              Log in
            </Link>
          </>
        }
      >
        <form onSubmit={handleSignUp} className="flex flex-col gap-4">
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

          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={AUTH_INPUT}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="repeat-password">Repeat password</Label>
            <Input
              id="repeat-password"
              type="password"
              autoComplete="new-password"
              required
              value={repeatPassword}
              onChange={(e) => setRepeatPassword(e.target.value)}
              className={AUTH_INPUT}
            />
          </div>

          {error && <AuthError message={error} />}

          <button type="submit" disabled={isLoading} className={AUTH_SUBMIT}>
            {isLoading ? "Creating your account…" : "Sign up"}
          </button>
        </form>
      </AuthCard>
    </div>
  );
}