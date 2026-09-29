import { Inbox } from "lucide-react";
import type { Metadata } from "next";
import { FirmwareTable } from "@/components/firmware-table";
import { EmptyState, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/guards";
import { listModels, listOrgs } from "@/lib/repo/directory";
import { listFirmwareByStatus } from "@/lib/repo/firmware";

export const metadata: Metadata = { title: "Review queue" };

export default async function ReviewPage() {
  await requireAdmin("/admin/review");
  const [items, orgs, models] = await Promise.all([listFirmwareByStatus("pending"), listOrgs(), listModels()]);
  return (
    <>
      <PageHeader title="Review queue" description="Releases waiting for approval, oldest first." />
      {items.length === 0 ? (
        <EmptyState icon={<Inbox className="size-6" />} title="All caught up">
          New submissions from suppliers will appear here.
        </EmptyState>
      ) : (
        <FirmwareTable
          items={items}
          dateField="submittedAt"
          orgName={Object.fromEntries(orgs.map((o) => [o._id, o.name]))}
          modelName={Object.fromEntries(models.map((m) => [m._id, m.name]))}
        />
      )}
    </>
  );
}
