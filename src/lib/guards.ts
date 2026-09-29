import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { logEventSoft, type Actor } from "./audit";
import { getOemUser, getSensorUser, listGroups } from "./repo/directory";
import { getSensorSession } from "./sensor-session";
import { entitledModelIds } from "./access";

// ---------- OIDC (OEM + admin) ----------

export async function currentOidc() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const oem = await getOemUser(session.user.id);
  const actor: Actor = {
    type: session.user.isAdmin ? "admin" : "oem",
    id: `oem:${session.user.id}`,
    email: session.user.email,
  };
  return { session, oem, actor, isAdmin: session.user.isAdmin };
}

/** OEM portal pages: signed-in OIDC user who is active and belongs to an org. */
export async function requireOem(path: string) {
  const ctx = await currentOidc();
  if (!ctx) redirect(`/portal/signin?callbackUrl=${encodeURIComponent(path)}`);
  if (!ctx.oem || ctx.oem.status !== "active" || !ctx.oem.orgId) {
    if (ctx.isAdmin) redirect("/admin");
    redirect("/portal/pending");
  }
  await logEventSoft(ctx.actor, "page.view", { meta: { path } });
  return { ...ctx, oem: ctx.oem, orgId: ctx.oem.orgId };
}

export async function requireAdmin(path: string) {
  const ctx = await currentOidc();
  if (!ctx) redirect(`/portal/signin?callbackUrl=${encodeURIComponent(path)}`);
  if (!ctx.isAdmin) {
    await logEventSoft(ctx.actor, "page.view", { result: "denied", meta: { path } });
    redirect("/portal");
  }
  await logEventSoft(ctx.actor, "page.view", { meta: { path } });
  return ctx;
}

/** For server actions / route handlers: returns null instead of redirecting. */
export async function adminOrNull() {
  const ctx = await currentOidc();
  return ctx?.isAdmin ? ctx : null;
}

export async function oemOrNull() {
  const ctx = await currentOidc();
  if (!ctx?.oem || ctx.oem.status !== "active" || !ctx.oem.orgId) return null;
  return { ...ctx, oem: ctx.oem, orgId: ctx.oem.orgId };
}

// ---------- Sensor users (passkey session) ----------

export async function currentSensor() {
  const s = await getSensorSession();
  if (!s.userId) return null;
  const user = await getSensorUser(s.userId);
  if (!user || user.status !== "active") return null;
  const groups = await listGroups();
  const actor: Actor = { type: "sensor", id: user._id, email: user.email };
  return { user, groups, modelIds: entitledModelIds(user, groups), actor };
}

export async function requireSensor(path: string) {
  const ctx = await currentSensor();
  if (!ctx) redirect(`/login?next=${encodeURIComponent(path)}`);
  await logEventSoft(ctx.actor, "page.view", { meta: { path } });
  return ctx;
}
