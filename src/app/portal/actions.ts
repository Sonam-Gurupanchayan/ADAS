"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logEvent } from "@/lib/audit";
import { oemOrNull } from "@/lib/guards";
import { listModels } from "@/lib/repo/directory";
import { createFirmware, getFirmware, transitionFirmware, updateFirmwareMeta } from "@/lib/repo/firmware";
import { firmwareInputSchema, firstError, formToObject } from "@/lib/schemas";

export type FormState = { error?: string; ok?: string } | undefined;

async function parse(formData: FormData, orgId: string) {
  const raw = formToObject(formData, ["modelIds"]);
  try {
    raw.knownIssues = JSON.parse(String(raw.knownIssues || "[]"));
  } catch {
    return { error: "Known issues could not be read." } as const;
  }
  const parsed = firmwareInputSchema.safeParse(raw);
  if (!parsed.success) return { error: firstError(parsed.error) } as const;
  // Suppliers may only target models an admin has assigned to their organisation.
  const allowed = new Set((await listModels()).filter((m) => m.manufacturerOrgId === orgId).map((m) => m._id));
  if (parsed.data.modelIds.some((m) => !allowed.has(m))) return { error: "One of the selected models isn't available to your organisation." } as const;
  return { data: parsed.data } as const;
}

export async function createFirmwareAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await oemOrNull();
  if (!ctx) return { error: "Your session has expired. Sign in again." };
  const p = await parse(formData, ctx.orgId);
  if ("error" in p) return { error: p.error };
  const fw = await createFirmware(ctx.orgId, ctx.actor.id!, p.data);
  await logEvent(ctx.actor, "firmware.create", { targetId: fw._id, meta: { version: fw.version, title: fw.title } });
  redirect(`/portal/firmware/${encodeURIComponent(fw._id)}?created=1`);
}

export async function updateFirmwareAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await oemOrNull();
  if (!ctx) return { error: "Your session has expired. Sign in again." };
  const fw = await getFirmware(id);
  if (!fw || fw.orgId !== ctx.orgId) return { error: "Not found." };
  const p = await parse(formData, ctx.orgId);
  if ("error" in p) return { error: p.error };
  const saved = await updateFirmwareMeta(id, p.data);
  if (!saved) return { error: "This release can't be edited while it is in review or published." };
  await logEvent(ctx.actor, "firmware.update", { targetId: id, meta: { version: saved.version } });
  revalidatePath(`/portal/firmware/${encodeURIComponent(id)}`);
  return { ok: "Saved." };
}

export async function submitFirmwareAction(id: string): Promise<FormState> {
  const ctx = await oemOrNull();
  if (!ctx) return { error: "Your session has expired. Sign in again." };
  const fw = await getFirmware(id);
  if (!fw || fw.orgId !== ctx.orgId) return { error: "Not found." };
  const next = await transitionFirmware(id, "submit", ctx.actor.id!);
  if (!next) return { error: fw.file ? "This release can't be submitted right now." : "Upload the firmware file first." };
  await logEvent(ctx.actor, "firmware.submit", { targetId: id, meta: { version: fw.version } });
  revalidatePath("/portal");
  revalidatePath(`/portal/firmware/${encodeURIComponent(id)}`);
  return { ok: "Submitted for review." };
}
