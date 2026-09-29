import { Download } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FirmwareForm } from "@/components/firmware-form";
import { FirmwareUpload, SubmitForReview } from "@/components/firmware-upload";
import { SensorPhotoUpload } from "@/components/sensor-photo";
import { Alert, Card, CardHeader, PageHeader, StatusBadge } from "@/components/ui";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { firmwareImageUrl } from "@/lib/image";
import { requireOem } from "@/lib/guards";
import { listModels } from "@/lib/repo/directory";
import { EDITABLE, getFirmware } from "@/lib/repo/firmware";
import { submitFirmwareAction, updateFirmwareAction } from "@/app/portal/actions";

export const metadata: Metadata = { title: "Release" };

export default async function EditFirmwarePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const id = decodeURIComponent((await params).id);
  const ctx = await requireOem(`/portal/firmware/${id}`);
  const fw = await getFirmware(id);
  if (!fw || fw.orgId !== ctx.orgId) notFound();
  const created = (await searchParams).created;
  const models = (await listModels()).filter((m) => m.manufacturerOrgId === ctx.orgId || fw.modelIds.includes(m._id));
  const editable = EDITABLE.includes(fw.status);

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {fw.title} <span className="font-mono text-lg font-normal text-fg-muted">v{fw.version}</span>
          </span>
        }
        description={`Created ${formatDate(fw.createdAt)}${fw.uploadedAt ? ` · file uploaded ${formatDate(fw.uploadedAt, true)} UTC` : ""}`}
        action={<StatusBadge status={fw.status} />}
      />

      <div className="mb-6 space-y-3">
        {created && <Alert tone="success">Draft created. Now upload the firmware image, then submit it for review.</Alert>}
        {fw.status === "rejected" && fw.reviewComment && (
          <Alert tone="danger">
            <strong>Changes requested:</strong> {fw.reviewComment}
          </Alert>
        )}
        {fw.status === "pending" && <Alert tone="warning">In review — editing is locked until an administrator approves or requests changes.</Alert>}
        {fw.status === "published" && <Alert tone="success">Published {formatDate(fw.publishedAt)}. To change it, create a new release.</Alert>}
        {fw.status === "withdrawn" && <Alert>Withdrawn by an administrator. It is no longer visible to sensor users.</Alert>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="p-5 sm:p-6">
          <FirmwareForm
            action={updateFirmwareAction.bind(null, fw._id)}
            initial={fw}
            models={models.map((m) => ({ id: m._id, name: m.name }))}
            submitLabel="Save changes"
            readOnly={!editable}
          />
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Firmware image" description="Streamed and checksummed on upload." />
            <div className="p-5">
              <FirmwareUpload id={fw._id} file={fw.file} editable={editable} maxBytes={env.maxUploadBytes} />
              {fw.file && (
                <a
                  href={`/api/firmware/${encodeURIComponent(fw._id)}/download`}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
                >
                  <Download className="size-4" /> Download current file
                </a>
              )}
            </div>
          </Card>
          <Card>
            <CardHeader title="Sensor photo" description="Shown to sensor users next to this release. Optional." />
            <div className="p-5">
              <SensorPhotoUpload id={fw._id} src={firmwareImageUrl(fw)} editable={editable} />
            </div>
          </Card>
          {editable && (
            <Card>
              <CardHeader title="Ready to publish?" description="An administrator reviews every release before sensor users can see it." />
              <div className="p-5">
                <SubmitForReview action={submitFirmwareAction.bind(null, fw._id)} disabled={!fw.file} />
                {!fw.file && <p className="mt-2 text-xs text-fg-subtle">Upload the firmware image first.</p>}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
