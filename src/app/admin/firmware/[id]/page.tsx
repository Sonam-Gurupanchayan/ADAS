import { Download } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Markdown } from "@/components/markdown";
import { SensorPhoto } from "@/components/sensor-photo";
import { AuditTable } from "@/components/audit-table";
import { Alert, Badge, Card, CardHeader, PageHeader, StatusBadge, Textarea, severityTone } from "@/components/ui";
import { queryAudit } from "@/lib/audit";
import { formatBytes, formatDate } from "@/lib/format";
import { firmwareImageUrl } from "@/lib/image";
import { requireAdmin } from "@/lib/guards";
import { getOrg, listModels } from "@/lib/repo/directory";
import { canTransition, getFirmware } from "@/lib/repo/firmware";
import { reviewFirmwareAction } from "@/app/admin/actions";

export const metadata: Metadata = { title: "Review release" };

export default async function AdminFirmwarePage({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id);
  await requireAdmin(`/admin/firmware/${id}`);
  const fw = await getFirmware(id);
  if (!fw) notFound();
  const [org, models, activity] = await Promise.all([getOrg(fw.orgId), listModels(), queryAudit({ targetId: id, limit: 50 })]);
  const modelName = Object.fromEntries(models.map((m) => [m._id, m.name]));
  const downloads = activity.docs.filter((a) => a.action === "firmware.download" && a.result === "ok").length;

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {fw.title} <span className="font-mono text-lg font-normal text-fg-muted">v{fw.version}</span>
          </span>
        }
        description={`${org?.name ?? fw.orgId} · created ${formatDate(fw.createdAt)}`}
        action={<StatusBadge status={fw.status} />}
      />
      {fw.reviewComment && (
        <div className="mb-6">
          <Alert tone={fw.status === "rejected" ? "danger" : "info"}>
            <strong>Review note:</strong> {fw.reviewComment}
          </Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-fg-subtle">Applicable models</h2>
            <div className="flex flex-wrap gap-1.5">
              {fw.modelIds.map((m) => (
                <Badge key={m} tone="brand">
                  {modelName[m] ?? m}
                </Badge>
              ))}
            </div>
            <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-fg-subtle">Known issues</h2>
            {fw.knownIssues.length === 0 ? (
              <p className="text-sm text-fg-subtle">None listed.</p>
            ) : (
              <ul className="space-y-2">
                {fw.knownIssues.map((i, n) => (
                  <li key={n} className="rounded-xl border border-line p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium">{i.title}</span>
                      <Badge tone={severityTone[i.severity]} className="capitalize">
                        {i.severity}
                      </Badge>
                    </div>
                    {i.workaround && <p className="mt-1 text-fg-muted">Workaround: {i.workaround}</p>}
                  </li>
                ))}
              </ul>
            )}
            <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-fg-subtle">Installation notes</h2>
            {fw.installationNotes ? <Markdown>{fw.installationNotes}</Markdown> : <p className="text-sm text-fg-subtle">None.</p>}
            <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-fg-subtle">Release notes</h2>
            {fw.releaseNotes ? <Markdown>{fw.releaseNotes}</Markdown> : <p className="text-sm text-fg-subtle">None.</p>}
          </Card>

          <Card>
            <CardHeader title="Activity" description={`${downloads} successful download${downloads === 1 ? "" : "s"} in the latest 50 events.`} />
            <AuditTable entries={activity.docs} compact />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="File" />
            <div className="space-y-2 p-5 text-sm">
              {fw.file ? (
                <>
                  <p className="truncate font-medium">{fw.file.name}</p>
                  <p className="text-fg-muted">{formatBytes(fw.file.size)} · uploaded {formatDate(fw.uploadedAt, true)} UTC</p>
                  <p className="break-all font-mono text-xs text-fg-subtle">sha256 {fw.file.sha256}</p>
                  <a href={`/api/firmware/${encodeURIComponent(fw._id)}/download`} className="inline-flex items-center gap-1.5 pt-1 font-medium text-brand hover:underline">
                    <Download className="size-4" /> Download to inspect
                  </a>
                </>
              ) : (
                <p className="text-fg-subtle">No file uploaded.</p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Sensor photo" description="Published with the release." />
            <div className="p-5">
              {fw.image ? (
                <SensorPhoto src={firmwareImageUrl(fw)} alt={`${fw.title} sensor`} className="aspect-[4/3] w-full rounded-xl" />
              ) : (
                <p className="text-sm text-fg-subtle">No photo supplied.</p>
              )}
            </div>
          </Card>

          {canTransition(fw, "approve") && (
            <Card>
              <CardHeader title="Decision" description="Approving publishes to every sensor user with access to these models." />
              <div className="space-y-4 p-5">
                <ActionForm action={reviewFirmwareAction.bind(null, fw._id, "approve")} submit="Approve & publish" variant="success" />
                <div className="border-t border-line pt-4">
                  <ActionForm action={reviewFirmwareAction.bind(null, fw._id, "reject")} submit="Request changes" variant="secondary">
                    <Textarea name="comment" rows={3} placeholder="What needs to change? (sent to the supplier)" required />
                  </ActionForm>
                </div>
              </div>
            </Card>
          )}
          {canTransition(fw, "withdraw") && (
            <Card>
              <CardHeader title="Withdraw" description="Hides the release from sensor users immediately." />
              <div className="p-5">
                <ActionForm action={reviewFirmwareAction.bind(null, fw._id, "withdraw")} submit="Withdraw release" variant="danger">
                  <Textarea name="comment" rows={2} placeholder="Reason (optional)" />
                </ActionForm>
              </div>
            </Card>
          )}
          {canTransition(fw, "republish") && (
            <Card>
              <CardHeader title="Republish" />
              <div className="p-5">
                <ActionForm action={reviewFirmwareAction.bind(null, fw._id, "republish")} submit="Republish" />
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
