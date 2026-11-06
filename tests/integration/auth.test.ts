import { beforeAll, describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { GET as me } from "@/app/api/auth/me/route";
import { prisma } from "@/server/db";
import { call, createUser, resetDb } from "../helpers";

describe("authentication", () => {
  beforeAll(async () => {
    await resetDb();
    await createUser("FRONT_DESK", "desk@test.local");
  });

  it("logs in with valid credentials, sets an httpOnly cookie and audits the login", async () => {
    const { status, json, res } = await call(login, { body: { email: "desk@test.local", password: "Test@12345" } });
    expect(status).toBe(200);
    expect(json.data.user.role).toBe("FRONT_DESK");
    expect(res.headers.get("set-cookie")).toMatch(/hms_session=.+HttpOnly/i);
    expect(await prisma.auditLog.count({ where: { action: "LOGIN" } })).toBe(1);
  });

  it("rejects a wrong password with 401 and records LOGIN_FAILED", async () => {
    const { status, json } = await call(login, { body: { email: "desk@test.local", password: "nope" } });
    expect(status).toBe(401);
    expect(json.error.code).toBe("UNAUTHENTICATED");
    expect(await prisma.auditLog.count({ where: { action: "LOGIN_FAILED" } })).toBe(1);
  });

  it("validates the login body", async () => {
    const { status, json } = await call(login, { body: { email: "not-an-email" } });
    expect(status).toBe(422);
    expect(json.error.details.fieldErrors.email).toBeDefined();
  });

  it("returns 401 for API calls without a session", async () => {
    const { status } = await call(me, {});
    expect(status).toBe(401);
  });
});
