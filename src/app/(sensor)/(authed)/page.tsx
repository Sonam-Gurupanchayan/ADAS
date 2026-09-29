import type { Metadata } from "next";
import { Library } from "@/components/library";
import { Alert } from "@/components/ui";
import { requireSensor } from "@/lib/guards";
import { getMany, listOrgs } from "@/lib/repo/directory";
import { listPublishedForModels } from "@/lib/repo/firmware";
import { DB } from "@/lib/couch";
import { firmwareImageUrl } from "@/lib/image";
import type { SensorModel } from "@/lib/types";

export const metadata: Metadata = { title: "Library" };

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const ctx = await requireSensor("/");
  const [firmware, models, orgs, sp] = await Promise.all([
    listPublishedForModels(ctx.modelIds),
    getMany<SensorModel>(DB.meta, ctx.modelIds),
    listOrgs(),
    searchParams,
  ]);
  const firstName = ctx.user.name.split(/\s+/)[0];
  const orgName = Object.fromEntries(orgs.map((o) => [o._id, o.name]));

  return (
    <div className="space-y-6">
      {sp.welcome && (
        <Alert tone="success">You&apos;re all set. Your passkey is registered — use it to sign in next time.</Alert>
      )}
      <div>
        <p className="text-sm font-medium text-brand">Welcome back, {firstName}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Firmware library</h1>
        <p className="mt-2 max-w-xl text-fg-muted">
          Approved releases for the {models.length === 1 ? "sensor model" : `${models.length} sensor models`} you
          look after.
        </p>
      </div>
      <Library
        items={firmware.map((f) => ({
          id: f._id,
          title: f.title,
          version: f.version,
          modelIds: f.modelIds.filter((m) => ctx.modelIds.includes(m)),
          publishedAt: f.publishedAt,
          size: f.file?.size ?? 0,
          issues: f.knownIssues.length,
          highIssues: f.knownIssues.filter((i) => i.severity === "high").length,
          supplier: orgName[f.orgId] ?? "",
          image: firmwareImageUrl(f),
        }))}
        models={models.map((m) => ({ id: m._id, name: m.name }))}
      />
    </div>
  );
}
