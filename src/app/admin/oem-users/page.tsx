import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, EmptyState, PageHeader, Select, Table } from "@/components/ui";
import { relativeDate } from "@/lib/format";
import { requireAdmin } from "@/lib/guards";
import { listOemUsers, listOrgs } from "@/lib/repo/directory";
import { updateOemUserAction } from "@/app/admin/actions";

export const metadata: Metadata = { title: "Supplier accounts" };

const tone = { pending: "warning", active: "success", disabled: "neutral" } as const;

export default async function OemUsersPage() {
  await requireAdmin("/admin/oem-users");
  const [users, orgs] = await Promise.all([listOemUsers(), listOrgs()]);
  users.sort((a, b) => (a.status === "pending" ? -1 : 0) - (b.status === "pending" ? -1 : 0));
  return (
    <>
      <PageHeader
        title="Supplier accounts"
        description="People who have signed in through single sign-on. Link them to an organisation and activate them to allow uploads."
      />
      {users.length === 0 ? (
        <EmptyState title="No one has signed in yet">Accounts appear here after their first sign-in.</EmptyState>
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <th>Person</th>
                <th>Status</th>
                <th>Last sign-in</th>
                <th>Organisation & access</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id}>
                  <td>
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-fg-muted">{u.email}</div>
                  </td>
                  <td>
                    <Badge tone={tone[u.status]} className="capitalize">
                      {u.status}
                    </Badge>
                  </td>
                  <td className="text-fg-muted">{relativeDate(u.lastLoginAt)}</td>
                  <td>
                    <ActionForm action={updateOemUserAction.bind(null, u._id)} variant="secondary" inline>
                      <Select name="orgId" defaultValue={u.orgId ?? ""} className="w-48 py-1.5">
                        <option value="">— No organisation —</option>
                        {orgs.map((o) => (
                          <option key={o._id} value={o._id}>
                            {o.name}
                          </option>
                        ))}
                      </Select>
                      <Select name="status" defaultValue={u.status} className="w-32 py-1.5">
                        <option value="pending">Pending</option>
                        <option value="active">Active</option>
                        <option value="disabled">Disabled</option>
                      </Select>
                    </ActionForm>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
