"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { cx } from "@/components/ui";

export function Sidebar({ items, user }: { items: { href: string; label: string }[]; user: { name: string; role: string } }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function logout() {
    setSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const active = (href: string) =>
    href === pathname || (href !== "/appointments" && pathname.startsWith(`${href}/`)) || (href === "/appointments" && pathname.startsWith("/appointments/") && !pathname.startsWith("/appointments/new"));

  return (
    <>
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <span className="font-semibold">HMS</span>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="sidebar" className="rounded-md px-3 py-1.5 text-sm ring-1 ring-slate-300">
          {open ? "Close" : "Menu"}
        </button>
      </div>
      <aside id="sidebar" className={cx("border-r border-slate-200 bg-white lg:sticky lg:top-0 lg:block lg:h-screen lg:w-60 lg:shrink-0", open ? "block" : "hidden")}>
        <div className="flex h-full flex-col">
          <div className="hidden items-center gap-2 px-5 py-5 lg:flex">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 font-bold text-white" aria-hidden="true">+</span>
            <span className="font-semibold">HMS</span>
          </div>
          <nav aria-label="Main" className="flex-1 space-y-0.5 px-3 py-2">
            {items.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                onClick={() => setOpen(false)}
                aria-current={active(i.href) ? "page" : undefined}
                className={cx(
                  "block rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-teal-600",
                  active(i.href) ? "bg-teal-50 text-teal-800" : "text-slate-700 hover:bg-slate-100",
                )}
              >
                {i.label}
              </Link>
            ))}
          </nav>
          <div className="border-t border-slate-200 p-4 text-sm">
            <p className="font-medium text-slate-900">{user.name}</p>
            <p className="text-xs text-slate-500">{user.role.replace("_", " ").toLowerCase()}</p>
            <button type="button" onClick={logout} disabled={signingOut} className="mt-3 text-sm font-medium text-teal-700 hover:underline disabled:opacity-50">
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
