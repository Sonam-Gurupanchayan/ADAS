import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { Card, CardHeader, Input, PageHeader, Table } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { requireAdmin } from "@/lib/guards";
import { listModels, listOemUsers, listOrgs } from "@/lib/repo/directory";
import { createOrgAction, renameOrgAction } from "@/app/admin/actions";

export const metadata: Metadata = { title: "Organisations" };

export default async function OrgsPage() {
  await requireAdmin("/admin/orgs");
  const [orgs, users, models] = await Promise.all([listOrgs(), listOemUsers(), listModels()]);
  return (
    <>
      <PageHeader title="Organisations" description="Firmware suppliers (OEMs). Supplier accounts and sensor models belong to one organisation." />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Add organisation" />
          <div className="p-5">
            <ActionForm action={createOrgAction} submit="Add" inline>
              <Input name="name" placeholder="Organisation name" required className="max-w-sm" />
            </ActionForm>
          </div>
        </Card>
        <Card>
          <Table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Accounts</th>
                <th>Models</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o._id}>
                  <td>
                    <ActionForm action={renameOrgAction.bind(null, o._id)} submit="Rename" variant="secondary" inline>
                      <Input name="name" defaultValue={o.name} required className="max-w-xs py-1.5" />
                    </ActionForm>
                  </td>
                  <td className="text-fg-muted">{users.filter((u) => u.orgId === o._id).length}</td>
                  <td className="text-fg-muted">{models.filter((m) => m.manufacturerOrgId === o._id).length}</td>
                  <td className="text-fg-muted">{formatDate(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </>
  );
}
