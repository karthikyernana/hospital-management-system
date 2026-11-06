import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-700 text-xl font-bold text-white" aria-hidden="true">
            +
          </div>
          <h1 className="text-2xl font-semibold">Hospital Management System</h1>
          <p className="mt-1 text-sm text-slate-600">Sign in with a demo account. All data is synthetic.</p>
        </div>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
