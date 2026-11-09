"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { AuthCard, AuthError, AUTH_INPUT, AUTH_SUBMIT } from "@/components/auth-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      // Update this route to redirect to an authenticated route. The user already has an active session.
      router.push("/protected");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <AuthCard
        title="Welcome back"
        description="Log in to keep sharing your moments."
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
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
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
            <div className="flex items-center">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/auth/forgot-password"
                className="ml-auto text-sm text-foreground/55 transition-colors hover:text-brand"
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

          {error && <AuthError message={error} />}

          <button type="submit" disabled={isLoading} className={AUTH_SUBMIT}>
            {isLoading ? "Logging in…" : "Log in"}
          </button>
        </form>
      </AuthCard>
    </div>
  );
}