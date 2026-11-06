import bcrypt from "bcryptjs";
import { prisma } from "../db";
import { audit } from "./audit";
import type { SessionUser } from "../auth/session";
import { AppError } from "../http/errors";

// Hash compared against when the email is unknown, so response time does not
// reveal whether an account exists.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export async function authenticate(email: string, password: string): Promise<SessionUser> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { doctor: { select: { id: true } }, patient: { select: { id: true } } },
  });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || !user.isActive) {
    await audit(user ? { id: user.id, role: user.role } : null, {
      action: "LOGIN_FAILED",
      entityType: "User",
      entityId: user?.id,
      metadata: { email: email.toLowerCase().trim() },
    });
    throw new AppError("UNAUTHENTICATED", 401, "Invalid email or password");
  }
  const session: SessionUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    doctorId: user.doctor?.id ?? null,
    patientId: user.patient?.id ?? null,
  };
  await audit(session, { action: "LOGIN", entityType: "User", entityId: user.id });
  return session;
}
