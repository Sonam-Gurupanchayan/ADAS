import { Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { Card, CardHeader, Field, Input, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/guards";
import { listGroups, listModels, listSensorUsers } from "@/lib/repo/directory";
import type { Group, SensorModel } from "@/lib/types";
import { deleteGroupAction, saveGroupAction } from "@/app/admin/actions";

export const metadata: Metadata = { title: "Access groups" };

function GroupFields({ group, models }: { group?: Group; models: SensorModel[] }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Group name">
          <Input name="name" defaultValue={group?.name} placeholder="e.g. Northern depot technicians" required />
        </Field>
        <Field label="Description">
          <Input name="description" defaultValue={group?.description} placeholder="Optional" />
        </Field>
      </div>
      <Field label="Sensor models this group can access">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {models.map((m) => (
            <label key={m._id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-3.5 py-2 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand/5">
              <input type="checkbox" name="modelIds" value={m._id} defaultChecked={group?.modelIds.includes(m._id)} className="size-4 accent-[var(--brand)]" />
              {m.name}
            </label>
          ))}
          {models.length === 0 && <p className="text-sm text-fg-subtle">Add sensor models first.</p>}
        </div>
      </Field>
    </>
  );
}

export default async function GroupsPage() {
  await requireAdmin("/admin/groups");
  const [groups, models, users] = await Promise.all([listGroups(), listModels(), listSensorUsers()]);
  return (
    <>
      <PageHeader title="Access groups" description="Users in a group can download published firmware for the group's sensor models." />
      <div className="space-y-6">
        <Card>
          <CardHeader title="New group" />
          <div className="p-5">
            <ActionForm action={saveGroupAction.bind(null, null)} submit="Create group">
              <GroupFields models={models} />
            </ActionForm>
          </div>
        </Card>
        {groups.map((g) => {
          const members = users.filter((u) => u.groupIds.includes(g._id)).length;
          return (
            <Card key={g._id}>
              <CardHeader
                title={g.name}
                description={`${members} member${members === 1 ? "" : "s"} · ${g.modelIds.length} model${g.modelIds.length === 1 ? "" : "s"}`}
                action={
                  <form action={deleteGroupAction.bind(null, g._id)}>
                    <button className="rounded-lg p-2 text-fg-subtle hover:bg-danger/10 hover:text-danger" aria-label={`Delete ${g.name}`} title="Delete group">
                      <Trash2 className="size-4" />
                    </button>
                  </form>
                }
              />
              <div className="p-5">
                <ActionForm action={saveGroupAction.bind(null, g._id)} variant="secondary">
                  <GroupFields group={g} models={models} />
                </ActionForm>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
