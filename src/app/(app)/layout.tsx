import { requireUser } from "@/server/auth/current-user";
import { navFor } from "@/components/nav/nav-items";
import { Sidebar } from "@/components/nav/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const items = navFor(user.role).map(({ href, label }) => ({ href, label }));
  return (
    <div className="lg:flex">
      <Sidebar items={items} user={{ name: user.name, role: user.role }} />
      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
