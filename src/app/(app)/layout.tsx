import { requireUser } from "@/server/auth/current-user";
import { navFor } from "@/components/nav/nav-items";
import { Sidebar } from "@/components/nav/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const items = navFor(user.role).map(({ href, label }) => ({ href, label }));
  return (
    <div className="lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:shadow">
        Skip to content
      </a>
      <Sidebar items={items} user={{ name: user.name, role: user.role }} />
      <main id="main" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 focus:outline-none sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
