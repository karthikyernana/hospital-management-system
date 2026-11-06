import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold text-rose-700">403 — Access denied</p>
        <h1 className="mt-2 text-2xl font-semibold">You don&apos;t have access to this page</h1>
        <p className="mt-2 text-sm text-slate-600">Your role does not include this permission. The attempt has been recorded.</p>
        <Link href="/" className="mt-6 inline-block text-sm font-medium text-teal-700 underline">Back to home</Link>
      </div>
    </main>
  );
}
