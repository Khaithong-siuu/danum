"use client";

import { useEffect, useRef, useState } from "react";
import { AuthCard, AuthError, AUTH_SUBMIT } from "@/components/auth-card";

/** Must match "Email OTP Length" in Supabase (Authentication > Providers > Email). Default is 6. */
export const CODE_LENGTH = 6;

/** Supabase only lets one email go out per address every 60 seconds. */
const RESEND_SECONDS = 60;

/**
 * "Enter the code we emailed you" screen, shared by log in, sign up and
 * password reset. The parent decides what verifying means; this only collects
 * the digits.
 *
 * It's a single field (not six boxes) on purpose: Android and iOS can then
 * autofill the code straight from the email notification.
 *
 * onVerify / onResend return an error message, or null when it worked.
 */
export function EmailCodeStep({
  email,
  title = "Enter your code",
  buttonLabel = "Verify",
  onVerify,
  onResend,
  onBack,
}: {
  email: string;
  title?: string;
  buttonLabel?: string;
  onVerify: (code: string) => Promise<string | null>;
  onResend: () => Promise<string | null>;
  onBack: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function submit(value: string) {
    if (busy || value.length !== CODE_LENGTH) return;

    setBusy(true);
    setError(null);
    setNotice(null);

    const problem = await onVerify(value);

    if (problem) {
      setError(problem);
      setCode("");
      setBusy(false);
      inputRef.current?.focus();
    }
    // On success the parent moves on (new page or next step), so stay "busy"
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setCode(digits);
    // Send it as soon as the last digit lands
    if (digits.length === CODE_LENGTH) void submit(digits);
  }

  async function resend() {
    if (cooldown > 0 || busy) return;

    setError(null);
    setNotice(null);
    setBusy(true);
    const problem = await onResend();
    setBusy(false);

    if (problem) {
      setError(problem);
      return;
    }
    setNotice("A new code is on its way.");
    setCooldown(RESEND_SECONDS);
  }

  return (
    <AuthCard
      title={title}
      description={`We sent a ${CODE_LENGTH}-digit code to ${email}. It can take a minute, and check spam too.`}
      footer={
        <button
          type="button"
          onClick={onBack}
          className="min-h-11 font-semibold text-brand hover:underline"
        >
          Use a different email
        </button>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(code);
        }}
        className="flex flex-col gap-4"
      >
        <input
          ref={inputRef}
          data-otp
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={CODE_LENGTH}
          aria-label={`${CODE_LENGTH}-digit code`}
          placeholder={"•".repeat(CODE_LENGTH)}
          value={code}
          onChange={handleChange}
          disabled={busy}
          className="h-16 w-full rounded-2xl border border-foreground/[0.1] bg-foreground/[0.04] pl-[0.5em] text-center text-[30px] font-semibold tracking-[0.5em] tabular-nums outline-none transition-all placeholder:text-foreground/20 focus:border-brand/50 focus:ring-2 focus:ring-brand/25 disabled:opacity-60"
        />

        {error && <AuthError message={error} />}
        {notice && !error && (
          <p className="text-center text-sm text-foreground/60" role="status">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || code.length !== CODE_LENGTH}
          className={AUTH_SUBMIT}
        >
          {busy ? "Checking…" : buttonLabel}
        </button>

        <button
          type="button"
          onClick={() => void resend()}
          disabled={cooldown > 0 || busy}
          className="min-h-11 text-sm font-medium text-foreground/60 transition-colors enabled:hover:text-brand disabled:opacity-60"
        >
          {cooldown > 0 ? `Send a new code in ${cooldown}s` : "Send a new code"}
        </button>
      </form>
    </AuthCard>
  );
}
