import { FileDown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuditTable } from "@/components/audit-table";
import { Button, Card, Input, PageHeader, Select, buttonClass } from "@/components/ui";
import { queryAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/guards";

export const metadata: Metadata = { title: "Audit log" };

type SP = { actorType?: string; action?: string; actorId?: string; targetId?: string; result?: string; from?: string; to?: string; bookmark?: string };

const ACTIONS = ["firmware.download", "firmware.view", "page.view", "auth.login", "auth.login_failed", "auth.logout", "passkey.*", "firmware.*", "admin.*"];

export default async function AuditPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin("/admin/audit");
  const sp = await searchParams;
  const filters = {
    actorType: sp.actorType || undefined,
    action: sp.action || undefined,
    actorId: sp.actorId || undefined,
    targetId: sp.targetId || undefined,
    result: sp.result || undefined,
    from: sp.from || undefined,
    to: sp.to ? `${sp.to}T23:59:59.999Z` : undefined,
  };
  const res = await queryAudit({ ...filters, limit: 100, bookmark: sp.bookmark });
  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "bookmark") as [string, string][]);
  const exportHref = `/api/admin/audit/export?${qs}`;
  const nextHref = res.docs.length === 100 && res.bookmark ? `/admin/audit?${new URLSearchParams({ ...Object.fromEntries(qs), bookmark: res.bookmark })}` : null;

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every sign-in, page view, download and administrative change. Entries are append-only."
        action={
          <a href={exportHref} className={buttonClass("secondary")}>
            <FileDown className="size-4" /> Export CSV
          </a>
        }
      />
      <Card className="mb-6 p-4">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" method="get">
          <Select name="actorType" defaultValue={sp.actorType ?? ""} aria-label="Actor type">
            <option value="">All actors</option>
            <option value="sensor">Sensor users</option>
            <option value="oem">Suppliers</option>
            <option value="admin">Admins</option>
            <option value="anon">Anonymous</option>
          </Select>
          <Select name="action" defaultValue={sp.action ?? ""} aria-label="Action">
            <option value="">All actions</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
          <Select name="result" defaultValue={sp.result ?? ""} aria-label="Result">
            <option value="">Any result</option>
            <option value="ok">ok</option>
            <option value="denied">denied</option>
            <option value="error">error</option>
          </Select>
          <Input name="actorId" defaultValue={sp.actorId} placeholder="Actor id (su:… / oem:…)" />
          <Input name="targetId" defaultValue={sp.targetId} placeholder="Target id (fw:…)" />
          <Input name="from" type="date" defaultValue={sp.from} aria-label="From" />
          <Input name="to" type="date" defaultValue={sp.to} aria-label="To" />
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">
              Filter
            </Button>
            <Link href="/admin/audit" className={buttonClass("ghost")}>
              Reset
            </Link>
          </div>
        </form>
      </Card>
      <Card>
        <AuditTable entries={res.docs} />
      </Card>
      {(sp.bookmark || nextHref) && (
        <div className="mt-4 flex justify-between">
          {sp.bookmark ? (
            <Link href={`/admin/audit?${qs}`} className={buttonClass("ghost", "sm")}>
              ← Newest
            </Link>
          ) : (
            <span />
          )}
          {nextHref && (
            <Link href={nextHref} className={buttonClass("secondary", "sm")}>
              Older →
            </Link>
          )}
        </div>
      )}
    </>
  );
}
