/** Predictable error envelope and edge cases at the HTTP boundary. */
import { beforeAll, describe, expect, it } from "vitest";
import { POST as bookRoute } from "@/app/api/appointments/route";
import { GET as patientsRoute } from "@/app/api/patients/route";
import { SESSION_COOKIE, signSession } from "@/server/auth/session";
import { seedFixtures, type Fixtures } from "../fixtures";
import { call } from "../helpers";

let f: Fixtures;
beforeAll(async () => {
  f = await seedFixtures();
});

describe("API contract", () => {
  it("returns { error: { code, message } } for malformed JSON", async () => {
    const req = new Request("http://localhost/api/appointments", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE}=${await signSession(f.users.desk)}` },
      body: "{not json",
    });
    const res = await bookRoute(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: { code: "VALIDATION_ERROR", message: "Request body must be valid JSON" } });
  });

  it("rejects a tampered session token", async () => {
    const token = await signSession(f.users.patient);
    const forged = token.slice(0, -3) + (token.endsWith("aaa") ? "bbb" : "aaa");
    const req = new Request("http://localhost/api/patients", { headers: { cookie: `${SESSION_COOKIE}=${forged}` } });
    expect((await patientsRoute(req, { params: Promise.resolve({}) })).status).toBe(401);
  });

  it("validates query strings (page size is capped)", async () => {
    const res = await call(patientsRoute, { user: f.users.desk, url: "/api/patients?pageSize=5000" });
    expect(res.status).toBe(422);
    expect(res.json.error.details.fieldErrors.pageSize).toBeDefined();
  });

  it("maps unknown records to 404 NOT_FOUND", async () => {
    const res = await call(bookRoute, { user: f.users.desk, body: { patientId: f.patient.id, doctorId: "missing", startTime: new Date(Date.now() + 86_400_000).toISOString() } });
    expect(res.status).toBe(404);
    expect(res.json.error.code).toBe("NOT_FOUND");
  });
});
