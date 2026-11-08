export function fullName(p: { firstName: string; lastName: string }) {
  return `${p.firstName} ${p.lastName}`;
}

export function ageFrom(dob: Date | string): number {
  const d = new Date(dob);
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age--;
  return age;
}

export function titleCase(s: string) {
  return s
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function dateInputValue(d: Date | string | null | undefined) {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}
