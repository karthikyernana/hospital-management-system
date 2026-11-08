import { z } from "zod";

export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PageQuery = z.infer<typeof pageQuery>;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const id = z.string().min(1).max(64);
/** Empty strings from HTML forms become undefined. */
export const optionalText = (max = 500) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max).optional());
export const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number");
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
