import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6 text-center">
      <div>
        <p className="text-sm font-semibold text-slate-500">404</p>
        <h1 className="mt-1 text-xl font-semibold">Not found</h1>
        <Link href="/" className="mt-4 inline-block text-sm font-medium text-teal-700 underline">Go home</Link>
      </div>
    </main>
  );
}
