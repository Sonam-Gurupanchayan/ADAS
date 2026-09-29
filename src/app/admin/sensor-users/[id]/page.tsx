import { ShieldCheck, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { AuditTable } from "@/components/audit-table";
import { Alert, Badge, Button, Card, CardHeader, Field, Input, PageHeader } from "@/components/ui";
import { queryAudit } from "@/lib/audit";
import { formatDate, relativeDate } from "@/lib/format";
import { requireAdmin } from "@/lib/guards";
import { getSensorUser, listGroups, listPasskeys } from "@/lib/repo/directory";
import { resendInviteAction, revokePasskeyAction, setSensorUserStatusAction, updateSensorUserAction } from "@/app/admin/actions";

export const metadata: Metadata = { title: "Sensor user" };

const statusTone = { invited: "warning", active: "success", disabled: "neutral" } as const;

export default async function SensorUserPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ invited?: string; inviteFailed?: string }> }) {
  const id = decodeURIComponent((await params).id);
  await requireAdmin(`/admin/sensor-users/${id}`);
  const user = await getSensorUser(id);
  if (!user) notFound();
  const sp = await searchParams;
  const [groups, passkeys, activity] = await Promise.all([listGroups(), listPasskeys(id), queryAudit({ actorId: id, limit: 50 })]);

  return (
    <>
      <PageHeader
        title={user.name}
        description={`${user.email} · added ${formatDate(user.createdAt)} · last sign-in ${relativeDate(user.lastLoginAt)}`}
        action={
          <Badge tone={statusTone[user.status]} className="capitalize">
            {user.status}
          </Badge>
        }
      />
      <div className="mb-6 space-y-3">
        {sp.invited && <Alert tone="success">Invite sent to {user.email}.</Alert>}
        {sp.inviteFailed && <Alert tone="danger">The user was created but the invite email failed. Check SMTP settings and use “Send new enrolment link”.</Alert>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Details & access" />
            <div className="p-5">
              <ActionForm action={updateSensorUserAction.bind(null, id)}>
                <Field label="Full name">
                  <Input name="name" defaultValue={user.name} required />
                </Field>
                <Field label="Access groups">
                  <div className="flex flex-wrap gap-2">
                    {groups.map((g) => (
                      <label key={g._id} className="flex cursor-pointer items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand/5">
                        <input type="checkbox" name="groupIds" value={g._id} defaultChecked={user.groupIds.includes(g._id)} className="size-3.5 accent-[var(--brand)]" />
                        {g.name}
                      </label>
                    ))}
                  </div>
                </Field>
              </ActionForm>
            </div>
          </Card>
          <Card>
            <CardHeader title="Recent activity" description="Sign-ins, page views and downloads by this user." />
            <AuditTable entries={activity.docs} compact />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Passkeys" description={passkeys.length ? undefined : "Not enrolled yet."} />
            <ul className="divide-y divide-line">
              {passkeys.map((p) => (
                <li key={p._id} className="flex items-center gap-3 px-5 py-3">
                  <ShieldCheck className="size-4 shrink-0 text-success" />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="truncate font-medium">{p.deviceName}</p>
                    <p className="text-xs text-fg-subtle">Last used {relativeDate(p.lastUsedAt)}</p>
                  </div>
                  <form action={revokePasskeyAction.bind(null, id, p.credentialId)}>
                    <button className="rounded-lg p-2 text-fg-subtle hover:bg-danger/10 hover:text-danger" aria-label="Revoke passkey" title="Revoke">
                      <Trash2 className="size-4" />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
            {user.status !== "disabled" && (
              <div className="border-t border-line p-5">
                <ActionForm action={async () => { "use server"; return resendInviteAction(id); }} submit="Send new enrolment link" variant="secondary" />
                <p className="mt-2 text-xs text-fg-subtle">Use this for lost devices. Existing passkeys stay valid until revoked.</p>
              </div>
            )}
          </Card>
          <Card>
            <CardHeader title={user.status === "disabled" ? "Re-enable access" : "Disable access"} />
            <div className="p-5">
              <form action={setSensorUserStatusAction.bind(null, id, user.status === "disabled" ? "active" : "disabled")}>
                <Button variant={user.status === "disabled" ? "success" : "danger"} className="w-full">
                  {user.status === "disabled" ? "Enable user" : "Disable user"}
                </Button>
              </form>
              <p className="mt-2 text-xs text-fg-subtle">Disabled users are signed out on their next request and cannot download anything.</p>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
