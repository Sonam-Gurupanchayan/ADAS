import { KeyRound, Layers, ShieldCheck, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { AddPasskey, SensorSignOut } from "@/components/passkey";
import { Badge, Card, CardHeader } from "@/components/ui";
import { logEvent } from "@/lib/audit";
import { DB } from "@/lib/couch";
import { formatDate, relativeDate } from "@/lib/format";
import { currentSensor, requireSensor } from "@/lib/guards";
import { deletePasskey, getMany, listPasskeys } from "@/lib/repo/directory";
import type { SensorModel } from "@/lib/types";

export const metadata: Metadata = { title: "Profile" };

async function removePasskey(formData: FormData) {
  "use server";
  const ctx = await currentSensor();
  if (!ctx) return;
  const credentialId = String(formData.get("credentialId") ?? "");
  const keys = await listPasskeys(ctx.user._id);
  // Never let a user remove their last passkey — they'd lock themselves out.
  if (keys.length <= 1) return;
  if (await deletePasskey(credentialId, ctx.user._id)) {
    await logEvent(ctx.actor, "passkey.removed", { targetId: `cred:${credentialId}` });
  }
  revalidatePath("/profile");
}

export default async function ProfilePage() {
  const ctx = await requireSensor("/profile");
  const [passkeys, models] = await Promise.all([listPasskeys(ctx.user._id), getMany<SensorModel>(DB.meta, ctx.modelIds)]);
  const groups = ctx.groups.filter((g) => ctx.user.groupIds.includes(g._id));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-2 text-xl font-semibold text-white shadow-lg shadow-brand/25">
          {ctx.user.name
            .split(/\s+/)
            .map((p) => p[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{ctx.user.name}</h1>
          <p className="truncate text-fg-muted">{ctx.user.email}</p>
        </div>
      </div>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <KeyRound className="size-4 text-brand" /> Passkeys
            </span>
          }
          description="Each sign-in needs one of these devices plus its fingerprint, face or PIN."
        />
        <ul className="divide-y divide-line">
          {passkeys.map((p) => (
            <li key={p._id} className="flex items-center gap-4 px-5 py-4">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-fg-muted">
                <ShieldCheck className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-medium">
                  {p.deviceName}
                  {p.backedUp && <Badge tone="info">Synced</Badge>}
                </p>
                <p className="text-xs text-fg-subtle">
                  Added {formatDate(p.createdAt)} · Last used {relativeDate(p.lastUsedAt)}
                </p>
              </div>
              {passkeys.length > 1 && (
                <form action={removePasskey}>
                  <input type="hidden" name="credentialId" value={p.credentialId} />
                  <button className="rounded-lg p-2 text-fg-subtle transition hover:bg-danger/10 hover:text-danger" aria-label={`Remove ${p.deviceName}`}>
                    <Trash2 className="size-4" />
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
        <div className="border-t border-line px-5 py-4">
          <AddPasskey />
        </div>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Layers className="size-4 text-brand" /> Your access
            </span>
          }
          description="Managed by your administrator."
        />
        <div className="space-y-4 px-5 py-4">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-fg-subtle">Groups</p>
            <div className="flex flex-wrap gap-1.5">
              {groups.length ? groups.map((g) => <Badge key={g._id}>{g.name}</Badge>) : <span className="text-sm text-fg-subtle">None</span>}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-fg-subtle">Sensor models</p>
            <div className="flex flex-wrap gap-1.5">
              {models.length ? models.map((m) => <Badge key={m._id} tone="brand">{m.name}</Badge>) : <span className="text-sm text-fg-subtle">None</span>}
            </div>
          </div>
        </div>
      </Card>

      <SensorSignOut className="h-11 w-full rounded-xl border border-line bg-surface text-sm font-medium text-danger transition hover:bg-danger/5" />
    </div>
  );
}
