import { z } from "zod";

const trimmed = (max: number) => z.string().trim().max(max);

export const knownIssueSchema = z.object({
  title: trimmed(200).min(1, "Issue title is required"),
  severity: z.enum(["low", "medium", "high"]),
  workaround: trimmed(4000).default(""),
});

export const firmwareInputSchema = z.object({
  title: trimmed(200).min(1, "Title is required"),
  version: trimmed(64)
    .min(1, "Version is required")
    .regex(/^[\w.+\-]+$/, "Use letters, numbers, dots, dashes, plus or underscore"),
  modelIds: z.array(z.string().startsWith("model:")).min(1, "Select at least one sensor model"),
  releaseNotes: trimmed(50_000).default(""),
  installationNotes: trimmed(50_000).default(""),
  knownIssues: z.array(knownIssueSchema).max(100).default([]),
});

export const nameSchema = z.object({ name: trimmed(120).min(1, "Name is required") });

export const modelSchema = z.object({
  name: trimmed(120).min(1, "Name is required"),
  manufacturerOrgId: z
    .string()
    .transform((v) => (v ? v : null))
    .nullable(),
  description: trimmed(2000).default(""),
});

export const groupSchema = z.object({
  name: trimmed(120).min(1, "Name is required"),
  description: trimmed(2000).default(""),
  modelIds: z.array(z.string().startsWith("model:")).default([]),
});

export const sensorUserSchema = z.object({
  name: trimmed(120).min(1, "Name is required"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  groupIds: z.array(z.string().startsWith("group:")).default([]),
});

export const oemUserPatchSchema = z.object({
  orgId: z
    .string()
    .transform((v) => (v ? v : null))
    .nullable(),
  status: z.enum(["pending", "active", "disabled"]),
});

/** Turn FormData into a plain object; repeated keys become arrays for the listed fields. */
export function formToObject(fd: FormData, arrays: string[] = []) {
  const out: Record<string, unknown> = {};
  for (const key of new Set(fd.keys())) {
    out[key] = arrays.includes(key) ? fd.getAll(key).map(String) : String(fd.get(key) ?? "");
  }
  for (const key of arrays) out[key] ??= [];
  return out;
}

export function firstError(e: z.ZodError) {
  return e.issues[0]?.message ?? "Invalid input";
}
