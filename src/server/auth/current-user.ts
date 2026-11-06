/**
 * Session helpers for Server Components / pages. Pages call `requireUser`
 * (or `requirePermission`) at the top, so a page never renders data for a role
 * that is not allowed to see it — even if someone types the URL directly.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession, type SessionUser } from "./session";
import { can, type Permission } from "./permissions";

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) redirect(`/forbidden?need=${encodeURIComponent(permission)}`);
  return user;
}
