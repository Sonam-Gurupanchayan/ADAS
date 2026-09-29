import { AlertTriangle, ArrowLeft, CalendarDays, Download, FileArchive, Fingerprint, HardDrive, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { Markdown } from "@/components/markdown";
import { SensorPhoto } from "@/components/sensor-photo";
import { Badge, Card, severityTone } from "@/components/ui";
import { canSensorUserAccess } from "@/lib/access";
import { logEvent } from "@/lib/audit";
import { DB } from "@/lib/couch";
import { formatBytes, formatDate } from "@/lib/format";
import { firmwareImageUrl } from "@/lib/image";
import { requireSensor } from "@/lib/guards";
import { getMany, getOrg } from "@/lib/repo/directory";
import { getFirmware, listPublishedForModels } from "@/lib/repo/firmware";
import type { SensorModel } from "@/lib/types";

export const metadata: Metadata = { title: "Firmware" };

export default async function FirmwarePage({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id);
  const ctx = await requireSensor(`/firmware/${id}`);
  const fw = await getFirmware(id);

  if (!fw || !canSensorUserAccess(ctx.user, ctx.groups, fw)) {
    await logEvent(ctx.actor, "firmware.view", { targetId: id, result: "denied" });
    notFound();
  }
  await logEvent(ctx.actor, "firmware.view", { targetId: id, meta: { version: fw.version } });

  const visibleModels = fw.modelIds.filter((m) => ctx.modelIds.includes(m));
  const [models, org, siblings] = await Promise.all([
    getMany<SensorModel>(DB.meta, visibleModels),
    getOrg(fw.orgId),
    listPublishedForModels(visibleModels),
  ]);
  const others = siblings.filter((s) => s._id !== fw._id).slice(0, 6);
  const photo = firmwareImageUrl(fw);
  const downloadHref = `/api/firmware/${encodeURIComponent(fw._id)}/download`;
  const issues = [...fw.knownIssues].sort((a, b) => ["high", "medium", "low"].indexOf(a.severity) - ["high", "medium", "low"].indexOf(b.severity));

  return (
    <div className="pb-20 sm:pb-0">
      <Link href="/" className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Library
      </Link>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-gradient-to-br from-brand/20 to-brand-2/10 blur-3xl" />
        <div className={photo ? "relative grid gap-6 sm:grid-cols-[1fr_220px] sm:items-start lg:grid-cols-[1fr_280px]" : "relative"}>
          {photo && (
            <SensorPhoto
              src={photo}
              alt={`${models.map((m) => m.name).join(", ") || fw.title} sensor`}
              className="order-first aspect-[4/3] w-full rounded-2xl sm:order-last sm:aspect-square"
            />
          )}
          <div>
            <div className="flex flex-wrap gap-1.5">
              {models.map((m) => (
                <Badge key={m._id} tone="brand">
                  {m.name}
                </Badge>
              ))}
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{fw.title}</h1>
            <p className="mt-1 font-mono text-lg text-fg-muted">v{fw.version}</p>
            {org && <p className="mt-1 text-sm text-fg-subtle">Supplied by {org.name}</p>}

            <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <Meta icon={<CalendarDays className="size-4" />} label="Published" value={formatDate(fw.publishedAt)} />
              <Meta icon={<HardDrive className="size-4" />} label="Size" value={fw.file ? formatBytes(fw.file.size) : "—"} />
              <Meta icon={<FileArchive className="size-4" />} label="Uploaded" value={formatDate(fw.uploadedAt)} />
            </dl>

            {fw.file && (
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <a
                  href={downloadHref}
                  className="hidden h-12 items-center justify-center gap-2 rounded-xl bg-brand px-6 font-medium text-brand-fg shadow-lg shadow-brand/25 transition hover:bg-brand/90 sm:inline-flex"
                >
                  <Download className="size-5" /> Download firmware
                </a>
                <span className="truncate text-sm text-fg-subtle">{fw.file.name}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {issues.length > 0 && (
            <Section title="Known issues" icon={<AlertTriangle className="size-4" />}>
              <ul className="space-y-3">
                {issues.map((i, n) => (
                  <li key={n} className="rounded-xl border border-line bg-surface-2/50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-fg">{i.title}</p>
                      <Badge tone={severityTone[i.severity]} className="capitalize">
                        {i.severity}
                      </Badge>
                    </div>
                    {i.workaround && (
                      <p className="mt-2 text-sm text-fg-muted">
                        <span className="font-medium text-fg">Workaround: </span>
                        {i.workaround}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Installation notes" icon={<Wrench className="size-4" />}>
            {fw.installationNotes ? <Markdown>{fw.installationNotes}</Markdown> : <p className="text-sm text-fg-subtle">No installation notes provided.</p>}
          </Section>

          <Section title="Release notes" icon={<FileArchive className="size-4" />}>
            {fw.releaseNotes ? <Markdown>{fw.releaseNotes}</Markdown> : <p className="text-sm text-fg-subtle">No release notes provided.</p>}
          </Section>
        </div>

        <aside className="space-y-6">
          {fw.file && (
            <Card className="p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Fingerprint className="size-4 text-brand" /> Verify your download
              </h3>
              <p className="mt-1 text-xs text-fg-muted">Compare this SHA-256 checksum with the file you downloaded before installing.</p>
              <div className="mt-3 rounded-xl bg-surface-2 p-3">
                <code className="block break-all font-mono text-xs leading-relaxed text-fg">{fw.file.sha256}</code>
              </div>
              <div className="mt-2 flex justify-end">
                <CopyButton value={fw.file.sha256} label="Copy checksum" />
              </div>
            </Card>
          )}

          {others.length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold">Other releases</h3>
              <ul className="mt-3 divide-y divide-line">
                {others.map((o) => (
                  <li key={o._id}>
                    <Link href={`/firmware/${encodeURIComponent(o._id)}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-brand">
                      <span className="truncate">{o.title}</span>
                      <span className="shrink-0 font-mono text-xs text-fg-subtle">v{o.version}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>

      {/* Mobile sticky download bar */}
      {fw.file && (
        <div
          className="fixed inset-x-0 z-20 border-t border-line/70 bg-bg/90 px-4 pt-3 backdrop-blur-xl sm:hidden"
          style={{ bottom: "calc(63px + env(safe-area-inset-bottom))" }}
        >
          <a
            href={downloadHref}
            className="mb-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand font-medium text-brand-fg shadow-lg shadow-brand/25 active:bg-brand/90"
          >
            <Download className="size-5" /> Download · {formatBytes(fw.file.size)}
          </a>
        </div>
      )}
    </div>
  );
}

function Meta({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs text-fg-subtle">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 font-medium text-fg">{value}</dd>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-2 font-semibold">
        <span className="grid size-7 place-items-center rounded-lg bg-surface-2 text-fg-muted">{icon}</span>
        {title}
      </h2>
      {children}
    </Card>
  );
}
