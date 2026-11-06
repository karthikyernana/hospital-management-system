/**
 * Directory: departments, doctors (with weekly schedules) and other staff.
 * Everyone signed in can browse it; only administrators can change it.
 */
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db";
import { assertCan } from "../auth/permissions";
import type { SessionUser } from "../auth/session";
import { notFound, validationError } from "../http/errors";
import { audit } from "./audit";
import type { Paginated } from "@/lib/validation/common";
import { departmentInput, doctorInput, doctorListQuery, staffInput, staffListQuery, type ScheduleWindow } from "@/lib/validation/directory";

export async function listDepartments(actor: SessionUser) {
  assertCan(actor.role, "directory:read");
  return prisma.department.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { doctors: true, staff: true } } },
  });
}

export async function createDepartment(actor: SessionUser, input: z.infer<typeof departmentInput>) {
  assertCan(actor.role, "directory:write");
  const dept = await prisma.department.create({ data: input });
  await audit(actor, { action: "CREATE", entityType: "Department", entityId: dept.id });
  return dept;
}

const doctorListInclude = { department: { select: { id: true, name: true, code: true } } } satisfies Prisma.DoctorInclude;
export type DoctorListItem = Prisma.DoctorGetPayload<{ include: typeof doctorListInclude }>;

export async function listDoctors(actor: SessionUser, q: z.infer<typeof doctorListQuery>): Promise<Paginated<DoctorListItem>> {
  assertCan(actor.role, "directory:read");
  const terms = q.q?.split(/\s+/).filter(Boolean) ?? [];
  const where: Prisma.DoctorWhereInput = {
    isActive: true,
    departmentId: q.departmentId || undefined,
    AND: terms.map((t) => ({
      OR: [
        { firstName: { contains: t, mode: "insensitive" } },
        { lastName: { contains: t, mode: "insensitive" } },
        { specialty: { contains: t, mode: "insensitive" } },
      ],
    })),
  };
  const [items, total] = await Promise.all([
    prisma.doctor.findMany({
      where,
      include: doctorListInclude,
      orderBy: [{ lastName: "asc" }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.doctor.count({ where }),
  ]);
  return { items, total, page: q.page, pageSize: q.pageSize };
}

export async function getDoctor(actor: SessionUser, id: string) {
  assertCan(actor.role, "directory:read");
  const doctor = await prisma.doctor.findUnique({
    where: { id },
    include: { department: true, schedules: { orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }] } },
  });
  if (!doctor) throw notFound("Doctor");
  return doctor;
}

export async function createDoctor(actor: SessionUser, input: z.infer<typeof doctorInput>) {
  assertCan(actor.role, "directory:write");
  const { createLogin, initialPassword, ...data } = input;
  if (createLogin && !initialPassword) throw validationError("An initial password is required to create a login");
  return prisma.$transaction(async (tx) => {
    const user = createLogin
      ? await tx.user.create({
          data: {
            email: data.email,
            name: `Dr. ${data.firstName} ${data.lastName}`,
            role: "CLINICIAN",
            passwordHash: await bcrypt.hash(initialPassword!, 10),
          },
        })
      : null;
    const doctor = await tx.doctor.create({ data: { ...data, userId: user?.id } });
    await audit(actor, { action: "CREATE", entityType: "Doctor", entityId: doctor.id }, tx);
    return doctor;
  });
}

/** Weekly windows for the same day must not overlap each other. */
export function findScheduleOverlap(windows: ScheduleWindow[]): string | null {
  const sorted = [...windows].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (prev.dayOfWeek === cur.dayOfWeek && cur.startMinute < prev.endMinute) {
      return `Working windows overlap on day ${cur.dayOfWeek}`;
    }
  }
  return null;
}

/**
 * Replace a doctor's weekly schedule. Existing appointments are not touched;
 * the new schedule only affects which future slots are offered.
 */
export async function replaceSchedule(actor: SessionUser, doctorId: string, windows: ScheduleWindow[]) {
  assertCan(actor.role, "directory:write");
  const overlap = findScheduleOverlap(windows);
  if (overlap) throw validationError(overlap);
  return prisma.$transaction(async (tx) => {
    const doctor = await tx.doctor.findUnique({ where: { id: doctorId }, select: { id: true } });
    if (!doctor) throw notFound("Doctor");
    await tx.doctorSchedule.deleteMany({ where: { doctorId } });
    await tx.doctorSchedule.createMany({ data: windows.map((w) => ({ ...w, doctorId })) });
    await audit(actor, { action: "UPDATE", entityType: "DoctorSchedule", entityId: doctorId, metadata: { windows: windows.length } }, tx);
    return tx.doctorSchedule.findMany({ where: { doctorId }, orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }] });
  });
}

const staffInclude = { department: { select: { id: true, name: true } } } satisfies Prisma.StaffMemberInclude;
export type StaffListItem = Prisma.StaffMemberGetPayload<{ include: typeof staffInclude }>;

export async function listStaff(actor: SessionUser, q: z.infer<typeof staffListQuery>): Promise<Paginated<StaffListItem>> {
  assertCan(actor.role, "directory:read");
  const terms = q.q?.split(/\s+/).filter(Boolean) ?? [];
  const where: Prisma.StaffMemberWhereInput = {
    isActive: true,
    staffRole: q.staffRole,
    departmentId: q.departmentId || undefined,
    AND: terms.map((t) => ({
      OR: [{ firstName: { contains: t, mode: "insensitive" } }, { lastName: { contains: t, mode: "insensitive" } }],
    })),
  };
  const [items, total] = await Promise.all([
    prisma.staffMember.findMany({ where, include: staffInclude, orderBy: [{ lastName: "asc" }], skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
    prisma.staffMember.count({ where }),
  ]);
  return { items, total, page: q.page, pageSize: q.pageSize };
}

export async function createStaff(actor: SessionUser, input: z.infer<typeof staffInput>) {
  assertCan(actor.role, "directory:write");
  const staff = await prisma.staffMember.create({ data: input });
  await audit(actor, { action: "CREATE", entityType: "StaffMember", entityId: staff.id });
  return staff;
}
