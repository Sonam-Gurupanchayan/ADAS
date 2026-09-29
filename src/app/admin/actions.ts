"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logEvent } from "@/lib/audit";
import { env } from "@/lib/env";
import { adminOrNull } from "@/lib/guards";
import { sendEnrolmentEmail } from "@/lib/mail";
import * as dir from "@/lib/repo/directory";
import { deletePasskey } from "@/lib/repo/directory";
import { transitionFirmware, type TransitionName } from "@/lib/repo/firmware";
import { firstError, formToObject, groupSchema, modelSchema, nameSchema, oemUserPatchSchema, sensorUserSchema } from "@/lib/schemas";

export type ActionState = { error?: string; ok?: string } | undefined;

async function admin() {
  const ctx = await adminOrNull();
  if (!ctx) throw new Error("Forbidden");
  return ctx;
}

// ---------- Firmware review ----------

export async function reviewFirmwareAction(id: string, t: TransitionName, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await admin();
  if (t === "submit") return { error: "Invalid action" };
  const comment = String(formData.get("comment") ?? "").trim().slice(0, 4000);
  if (t === "reject" && !comment) return { error: "Tell the supplier what needs to change." };
  const fw = await transitionFirmware(id, t, ctx.actor.id!, comment);
  if (!fw) return { error: "The release is no longer in a state that allows this." };
  await logEvent(ctx.actor, `firmware.${t}`, { targetId: id, meta: { version: fw.version, comment: comment || undefined } });
  revalidatePath("/admin", "layout");
  return { ok: { approve: "Published.", reject: "Sent back to the supplier.", withdraw: "Withdrawn.", republish: "Republished." }[t] };
}

// ---------- Orgs ----------

export async function createOrgAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await admin();
  const p = nameSchema.safeParse(formToObject(fd));
  if (!p.success) return { error: firstError(p.error) };
  const org = await dir.createOrg(p.data.name);
  await logEvent(ctx.actor, "admin.org_create", { targetId: org._id, meta: { name: org.name } });
  revalidatePath("/admin/orgs");
  return { ok: `Created ${org.name}.` };
}

export async function renameOrgAction(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await admin();
  const p = nameSchema.safeParse(formToObject(fd));
  if (!p.success) return { error: firstError(p.error) };
  await dir.renameOrg(id, p.data.name);
  await logEvent(ctx.actor, "admin.org_update", { targetId: id, meta: { name: p.data.name } });
  revalidatePath("/admin/orgs");
  return { ok: "Saved." };
}

// ---------- Sensor models ----------

export async function saveModelAction(id: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await admin();
  const p = modelSchema.safeParse(formToObject(fd));
  if (!p.success) return { error: firstError(p.error) };
  if (p.data.manufacturerOrgId && !(await dir.getOrg(p.data.manufacturerOrgId))) return { error: "Unknown organisation." };
  if (id) {
    await dir.updateModel(id, p.data);
    await logEvent(ctx.actor, "admin.model_update", { targetId: id, meta: p.data });
  } else {
    const m = await dir.createModel(p.data);
    await logEvent(ctx.actor, "admin.model_create", { targetId: m._id, meta: p.data });
  }
  revalidatePath("/admin/models");
  return { ok: "Saved." };
}

// ---------- Groups ----------

export async function saveGroupAction(id: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await admin();
  const p = groupSchema.safeParse(formToObject(fd, ["modelIds"]));
  if (!p.success) return { error: firstError(p.error) };
  if (id) {
    await dir.updateGroup(id, p.data);
    await logEvent(ctx.actor, "admin.group_update", { targetId: id, meta: p.data });
  } else {
    const g = await dir.createGroup(p.data);
    await logEvent(ctx.actor, "admin.group_create", { targetId: g._id, meta: p.data });
  }
  revalidatePath("/admin/groups");
  return { ok: "Saved." };
}

export async function deleteGroupAction(id: string) {
  const ctx = await admin();
  await dir.deleteGroup(id);
  await logEvent(ctx.actor, "admin.group_delete", { targetId: id });
  revalidatePath("/admin/groups");
}

// ---------- OEM users ----------

export async function updateOemUserAction(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await admin();
  const p = oemUserPatchSchema.safeParse(formToObject(fd));
  if (!p.success) return { error: firstError(p.error) };
  if (p.data.status === "active" && !p.data.orgId) return { error: "Choose an organisation before activating." };
  await dir.setOemUser(id, p.data);
  await logEvent(ctx.actor, "admin.oem_user_update", { targetId: id, meta: p.data });
  revalidatePath("/admin/oem-users");
  return { ok: "Saved." };
}

// ---------- Sensor users ----------

async function sendInvite(user: { _id: string; email: string; name: string }, by: string, reissue: boolean) {
  const token = await dir.createEnrolToken(user._id, by);
  await sendEnrolmentEmail(user, `${env.appOrigin}/enroll?token=${encodeURIComponent(token)}`, reissue);
}

export async function createSensorUserAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await admin();
  const p = sensorUserSchema.safeParse(formToObject(fd, ["groupIds"]));
  if (!p.success) return { error: firstError(p.error) };
  if (await dir.findSensorUserByEmail(p.data.email)) return { error: "A sensor user with that email already exists." };
  const user = await dir.createSensorUser(p.data, ctx.actor.id!);
  await logEvent(ctx.actor, "admin.sensor_user_create", { targetId: user._id, meta: { email: user.email, groupIds: user.groupIds } });
  try {
    await sendInvite(user, ctx.actor.id!, false);
    await logEvent(ctx.actor, "admin.sensor_user_invite", { targetId: user._id });
  } catch (e) {
    console.error("[invite] email failed", e);
    await logEvent(ctx.actor, "admin.sensor_user_invite", { targetId: user._id, result: "error", meta: { reason: String(e) } });
    redirect(`/admin/sensor-users/${encodeURIComponent(user._id)}?inviteFailed=1`);
  }
  redirect(`/admin/sensor-users/${encodeURIComponent(user._id)}?invited=1`);
}

export async function updateSensorUserAction(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await admin();
  const raw = formToObject(fd, ["groupIds"]);
  const p = sensorUserSchema.pick({ name: true, groupIds: true }).safeParse(raw);
  if (!p.success) return { error: firstError(p.error) };
  await dir.updateSensorUser(id, p.data);
  await logEvent(ctx.actor, "admin.sensor_user_update", { targetId: id, meta: p.data });
  revalidatePath(`/admin/sensor-users/${encodeURIComponent(id)}`);
  return { ok: "Saved." };
}

export async function setSensorUserStatusAction(id: string, status: "active" | "disabled") {
  const ctx = await admin();
  const user = await dir.getSensorUser(id);
  if (!user) return;
  // Re-enabling a user who never enrolled returns them to "invited".
  const hasKeys = (await dir.listPasskeys(id)).length > 0;
  const next = status === "active" && !hasKeys ? "invited" : status;
  await dir.updateSensorUser(id, { status: next });
  await logEvent(ctx.actor, status === "disabled" ? "admin.sensor_user_disable" : "admin.sensor_user_enable", { targetId: id });
  revalidatePath(`/admin/sensor-users/${encodeURIComponent(id)}`);
}

export async function resendInviteAction(id: string): Promise<ActionState> {
  const ctx = await admin();
  const user = await dir.getSensorUser(id);
  if (!user || user.status === "disabled") return { error: "User is disabled." };
  try {
    await sendInvite(user, ctx.actor.id!, true);
  } catch (e) {
    await logEvent(ctx.actor, "admin.sensor_user_invite", { targetId: id, result: "error", meta: { reason: String(e) } });
    return { error: "The email could not be sent. Check the SMTP settings." };
  }
  await logEvent(ctx.actor, "admin.sensor_user_invite", { targetId: id, meta: { reissue: true } });
  return { ok: `A new enrolment link was sent to ${user.email}.` };
}

export async function revokePasskeyAction(userId: string, credentialId: string) {
  const ctx = await admin();
  if (await deletePasskey(credentialId, userId)) {
    await logEvent(ctx.actor, "admin.passkey_revoke", { targetId: `cred:${credentialId}`, meta: { userId } });
  }
  revalidatePath(`/admin/sensor-users/${encodeURIComponent(userId)}`);
}
