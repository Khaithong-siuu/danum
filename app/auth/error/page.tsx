import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth-card";

async function ErrorContent({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  const params = await searchParams;

  return (
    <p className="rounded-xl bg-foreground/[0.05] px-3.5 py-2.5 text-center text-sm text-foreground/60">
      {params?.error
        ? `Error code: ${params.error}`
        : "An unspecified error occurred."}
    </p>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <AuthCard
          title="Something went wrong"
          description="Please try again. If it keeps happening, let us know."
          footer={
            <Link
              href="/auth/login"
              className="font-semibold text-brand hover:underline"
            >
              Back to log in
            </Link>
          }
        >
          <Suspense>
            <ErrorContent searchParams={searchParams} />
          </Suspense>
        </AuthCard>
      </div>
    </div>
  );
}
