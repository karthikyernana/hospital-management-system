/**
 * Runs once before the suite: applies all migrations to a clean test database.
 * Uses TEST_DATABASE_URL (defaults to a local hms_test database).
 */
import { execSync } from "node:child_process";

export default function setup() {
  const url =
    process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/hms_test?schema=public";
  execSync("npx prisma migrate reset --force --skip-seed --skip-generate", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}
