import { logEvent, queryAudit } from "@/lib/audit";
import { adminOrNull } from "@/lib/guards";
import type { AuditEntry } from "@/lib/types";

export const runtime = "nodejs";

const COLUMNS: (keyof AuditEntry)[] = ["ts", "actorType", "actorId", "actorEmail", "action", "targetId", "result", "ip", "userAgent", "meta"];

function csvCell(v: unknown) {
  const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  // Neutralise spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function GET(req: Request) {
  const ctx = await adminOrNull();
  if (!ctx) return new Response("Forbidden", { status: 403 });
  const p = new URL(req.url).searchParams;
  const q = {
    actorType: p.get("actorType") || undefined,
    action: p.get("action") || undefined,
    actorId: p.get("actorId") || undefined,
    targetId: p.get("targetId") || undefined,
    result: p.get("result") || undefined,
    from: p.get("from") || undefined,
    to: p.get("to") ? `${p.get("to")}T23:59:59.999Z` : undefined,
  };
  await logEvent(ctx.actor, "admin.audit_export", { meta: q });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(COLUMNS.join(",") + "\n"));
      let bookmark: string | undefined;
      // Page through with bookmarks; cap at 200k rows per export.
      for (let page = 0; page < 200; page++) {
        const res = await queryAudit({ ...q, limit: 1000, bookmark });
        for (const e of res.docs) controller.enqueue(encoder.encode(COLUMNS.map((c) => csvCell(e[c])).join(",") + "\n"));
        if (res.docs.length < 1000 || !res.bookmark) break;
        bookmark = res.bookmark;
      }
      controller.close();
    },
  });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
