import Link from "next/link";
import { formatBytes, relativeDate } from "@/lib/format";
import type { Firmware } from "@/lib/types";
import { Card, StatusBadge, Table } from "./ui";

export function FirmwareTable({ items, orgName, modelName, dateField = "updatedAt" }: { items: Firmware[]; orgName: Record<string, string>; modelName: Record<string, string>; dateField?: "updatedAt" | "submittedAt" }) {
  return (
    <Card>
      <Table>
        <thead>
          <tr>
            <th>Release</th>
            <th>Supplier</th>
            <th>Models</th>
            <th>Status</th>
            <th className="text-right">Size</th>
            <th className="text-right">{dateField === "submittedAt" ? "Submitted" : "Updated"}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((f) => (
            <tr key={f._id}>
              <td>
                <Link href={`/admin/firmware/${encodeURIComponent(f._id)}`} className="font-medium hover:text-brand">
                  {f.title}
                </Link>
                <div className="font-mono text-xs text-fg-subtle">v{f.version}</div>
              </td>
              <td className="text-fg-muted">{orgName[f.orgId] ?? f.orgId}</td>
              <td className="max-w-56 truncate text-fg-muted">{f.modelIds.map((m) => modelName[m] ?? m).join(", ")}</td>
              <td>
                <StatusBadge status={f.status} />
              </td>
              <td className="text-right text-fg-muted">{f.file ? formatBytes(f.file.size) : "—"}</td>
              <td className="text-right text-fg-muted">{relativeDate(f[dateField])}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
