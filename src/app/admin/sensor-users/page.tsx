import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, CardHeader, Field, Input, PageHeader, Table } from "@/components/ui";
import { relativeDate } from "@/lib/format";
import { requireAdmin } from "@/lib/guards";
import { listGroups, listSensorUsers } from "@/lib/repo/directory";
import { createSensorUserAction } from "@/app/admin/actions";

export const metadata: Metadata = { title: "Sensor users" };

const statusTone = { invited: "warning", active: "success", disabled: "neutral" } as const;

export default async function SensorUsersPage() {
  await requireAdmin("/admin/sensor-users");
  const [users, groups] = await Promise.all([listSensorUsers(), listGroups()]);
  const groupName = Object.fromEntries(groups.map((g) => [g._id, g.name]));
  return (
    <>
      <PageHeader title="Sensor users" description="People who download firmware. They sign in with a passkey created from an emailed invite." />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Invite a sensor user" description="They'll get a single-use link (valid 72 hours) to register a passkey." />
          <div className="p-5">
            <ActionForm action={createSensorUserAction} submit="Create & send invite">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name">
                  <Input name="name" required />
                </Field>
                <Field label="Email">
                  <Input name="email" type="email" required />
                </Field>
              </div>
              <Field label="Access groups">
                <div className="flex flex-wrap gap-2">
                  {groups.map((g) => (
                    <label key={g._id} className="flex cursor-pointer items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand/5">
                      <input type="checkbox" name="groupIds" value={g._id} className="size-3.5 accent-[var(--brand)]" />
                      {g.name}
                    </label>
                  ))}
                  {groups.length === 0 && <p className="text-sm text-fg-subtle">Create an access group first.</p>}
                </div>
              </Field>
            </ActionForm>
          </div>
        </Card>
        <Card>
          <Table>
            <thead>
              <tr>
                <th>Person</th>
                <th>Groups</th>
                <th>Status</th>
                <th className="text-right">Last sign-in</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id}>
                  <td>
                    <Link href={`/admin/sensor-users/${encodeURIComponent(u._id)}`} className="font-medium hover:text-brand">
                      {u.name}
                    </Link>
                    <div className="text-xs text-fg-muted">{u.email}</div>
                  </td>
                  <td className="max-w-64 truncate text-fg-muted">{u.groupIds.map((g) => groupName[g] ?? g).join(", ") || "—"}</td>
                  <td>
                    <Badge tone={statusTone[u.status]} className="capitalize">
                      {u.status}
                    </Badge>
                  </td>
                  <td className="text-right text-fg-muted">{relativeDate(u.lastLoginAt)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </>
  );
}
