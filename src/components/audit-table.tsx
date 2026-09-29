import { formatDate } from "@/lib/format";
import type { AuditEntry } from "@/lib/types";
import { Badge, Table } from "./ui";

const actorTone = { admin: "info", oem: "brand", sensor: "success", anon: "neutral" } as const;
const resultTone = { ok: "success", denied: "danger", error: "warning" } as const;

export function AuditTable({ entries, compact = false }: { entries: AuditEntry[]; compact?: boolean }) {
  if (entries.length === 0) return <p className="px-5 py-8 text-center text-sm text-fg-subtle">No events.</p>;
  return (
    <Table>
      <thead>
        <tr>
          <th>Time (UTC)</th>
          <th>Actor</th>
          <th>Action</th>
          {!compact && <th>Target</th>}
          <th>Result</th>
          {!compact && <th>IP</th>}
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <tr key={e._id} className="align-top">
            <td className="whitespace-nowrap font-mono text-xs text-fg-muted">{formatDate(e.ts, true)}</td>
            <td className="max-w-56">
              <Badge tone={actorTone[e.actorType]}>{e.actorType}</Badge>
              <div className="mt-1 truncate text-xs text-fg-muted" title={e.actorId ?? ""}>
                {e.actorEmail ?? e.actorId ?? "—"}
              </div>
            </td>
            <td>
              <span className="font-mono text-xs">{e.action}</span>
              {Object.keys(e.meta ?? {}).length > 0 && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-fg-subtle">details</summary>
                  <pre className="mt-1 max-w-md overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-surface-2 p-2 text-[11px] text-fg-muted">{JSON.stringify(e.meta, null, 2)}</pre>
                </details>
              )}
            </td>
            {!compact && <td className="max-w-48 truncate font-mono text-xs text-fg-muted" title={e.targetId ?? ""}>{e.targetId ?? "—"}</td>}
            <td>
              <Badge tone={resultTone[e.result]}>{e.result}</Badge>
            </td>
            {!compact && <td className="whitespace-nowrap font-mono text-xs text-fg-subtle">{e.ip ?? "—"}</td>}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
