import { Package } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FirmwareTable } from "@/components/firmware-table";
import { EmptyState, PageHeader } from "@/components/ui";
import { cn } from "@/lib/format";
import { requireAdmin } from "@/lib/guards";
import { listModels, listOrgs } from "@/lib/repo/directory";
import { listAllFirmware } from "@/lib/repo/firmware";
import type { FirmwareStatus } from "@/lib/types";

export const metadata: Metadata = { title: "All firmware" };

const STATUSES: FirmwareStatus[] = ["draft", "pending", "published", "rejected", "withdrawn"];

export default async function AllFirmwarePage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin("/admin/firmware");
  const s = (await searchParams).status;
  const status = STATUSES.includes(s as FirmwareStatus) ? (s as FirmwareStatus) : undefined;
  const [items, orgs, models] = await Promise.all([listAllFirmware(status), listOrgs(), listModels()]);
  return (
    <>
      <PageHeader title="All firmware" description="Every release from every supplier." />
      <div className="mb-4 flex flex-wrap gap-2">
        {[undefined, ...STATUSES].map((st) => (
          <Link
            key={st ?? "all"}
            href={st ? `/admin/firmware?status=${st}` : "/admin/firmware"}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium capitalize",
              st === status ? "bg-fg text-bg" : "border border-line bg-surface text-fg-muted hover:text-fg",
            )}
          >
            {st ?? "All"}
          </Link>
        ))}
      </div>
      {items.length === 0 ? (
        <EmptyState icon={<Package className="size-6" />} title="Nothing here" />
      ) : (
        <FirmwareTable items={items} orgName={Object.fromEntries(orgs.map((o) => [o._id, o.name]))} modelName={Object.fromEntries(models.map((m) => [m._id, m.name]))} />
      )}
    </>
  );
}
