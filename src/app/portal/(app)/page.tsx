import { PackagePlus, Upload } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, EmptyState, LinkButton, PageHeader, StatusBadge, Table } from "@/components/ui";
import { formatBytes, relativeDate } from "@/lib/format";
import { requireOem } from "@/lib/guards";
import { getOrg, listModels } from "@/lib/repo/directory";
import { listFirmwareForOrg } from "@/lib/repo/firmware";

export const metadata: Metadata = { title: "My firmware" };

export default async function PortalHome() {
  const ctx = await requireOem("/portal");
  if (ctx.isAdmin) redirect("/admin");
  const [items, org, models] = await Promise.all([listFirmwareForOrg(ctx.orgId), getOrg(ctx.orgId), listModels()]);
  const modelName = Object.fromEntries(models.map((m) => [m._id, m.name]));

  return (
    <>
      <PageHeader
        title="My firmware"
        description={`Releases uploaded by ${org?.name ?? "your organisation"}.`}
        action={
          <LinkButton href="/portal/firmware/new">
            <PackagePlus className="size-4" /> New release
          </LinkButton>
        }
      />
      {items.length === 0 ? (
        <EmptyState icon={<Upload className="size-6" />} title="No releases yet">
          Create a release, upload the firmware image and submit it for review.
        </EmptyState>
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <th>Release</th>
                <th>Models</th>
                <th>Status</th>
                <th className="text-right">Size</th>
                <th className="text-right">Updated</th>
              </tr>
            </thead>
            <tbody>
              {items.map((f) => (
                <tr key={f._id}>
                  <td>
                    <Link href={`/portal/firmware/${encodeURIComponent(f._id)}`} className="font-medium hover:text-brand">
                      {f.title}
                    </Link>
                    <div className="font-mono text-xs text-fg-subtle">v{f.version}</div>
                  </td>
                  <td className="max-w-64 truncate text-fg-muted">{f.modelIds.map((m) => modelName[m] ?? m).join(", ")}</td>
                  <td>
                    <StatusBadge status={f.status} />
                  </td>
                  <td className="text-right text-fg-muted">{f.file ? formatBytes(f.file.size) : "—"}</td>
                  <td className="text-right text-fg-muted">{relativeDate(f.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
