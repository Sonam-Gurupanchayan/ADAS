import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { Card, CardHeader, Field, Input, PageHeader, Select } from "@/components/ui";
import { requireAdmin } from "@/lib/guards";
import { listModels, listOrgs } from "@/lib/repo/directory";
import type { Org, SensorModel } from "@/lib/types";
import { saveModelAction } from "@/app/admin/actions";

export const metadata: Metadata = { title: "Sensor models" };

function ModelFields({ model, orgs }: { model?: SensorModel; orgs: Org[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label="Model name">
        <Input name="name" defaultValue={model?.name} placeholder="e.g. LRR-4 Front Radar" required />
      </Field>
      <Field label="Manufacturer" hint="Suppliers in this organisation can publish firmware for it.">
        <Select name="manufacturerOrgId" defaultValue={model?.manufacturerOrgId ?? ""}>
          <option value="">— Unassigned —</option>
          {orgs.map((o) => (
            <option key={o._id} value={o._id}>
              {o.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Description">
        <Input name="description" defaultValue={model?.description} placeholder="Optional" />
      </Field>
    </div>
  );
}

export default async function ModelsPage() {
  await requireAdmin("/admin/models");
  const [models, orgs] = await Promise.all([listModels(), listOrgs()]);
  return (
    <>
      <PageHeader title="Sensor models" description="The sensor types firmware can target. Access groups grant users access by model." />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Add sensor model" />
          <div className="p-5">
            <ActionForm action={saveModelAction.bind(null, null)} submit="Add model">
              <ModelFields orgs={orgs} />
            </ActionForm>
          </div>
        </Card>
        {models.map((m) => (
          <Card key={m._id}>
            <div className="p-5">
              <p className="mb-3 font-mono text-xs text-fg-subtle">{m._id}</p>
              <ActionForm action={saveModelAction.bind(null, m._id)} variant="secondary">
                <ModelFields model={m} orgs={orgs} />
              </ActionForm>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
