import type { Metadata } from "next";
import { EMPTY_FIRMWARE, FirmwareForm } from "@/components/firmware-form";
import { Card, PageHeader } from "@/components/ui";
import { requireOem } from "@/lib/guards";
import { listModels } from "@/lib/repo/directory";
import { createFirmwareAction } from "@/app/portal/actions";

export const metadata: Metadata = { title: "New release" };

export default async function NewFirmwarePage() {
  const ctx = await requireOem("/portal/firmware/new");
  const models = (await listModels()).filter((m) => m.manufacturerOrgId === ctx.orgId);
  return (
    <>
      <PageHeader title="New release" description="Describe the release first — you'll upload the firmware image on the next step." />
      <Card className="p-5 sm:p-6">
        <FirmwareForm
          action={createFirmwareAction}
          initial={EMPTY_FIRMWARE}
          models={models.map((m) => ({ id: m._id, name: m.name }))}
          submitLabel="Create draft"
        />
      </Card>
    </>
  );
}
