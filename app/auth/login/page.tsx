import { LoginForm } from "@/components/login-form";

export default function Page() {
  return (
    <div className="flex min-h-app w-full items-center justify-center px-4 pb-6 pt-safe-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  );
}
