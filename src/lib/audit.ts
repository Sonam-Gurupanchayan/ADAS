import "server-only";
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { DB, find, putDoc } from "./couch";
import type { ActorType, AuditEntry, AuditResult } from "./types";

export type Actor = { type: ActorType; id: string | null; email?: string | null };

export const ANON: Actor = { type: "anon", id: null };

async function requestInfo() {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    const ip = fwd ? fwd.split(",")[0].trim() : h.get("x-real-ip");
    return { ip: ip || null, userAgent: h.get("user-agent") };
  } catch {
    // Called outside a request scope (e.g. Auth.js events in some paths).
    return { ip: null, userAgent: null };
  }
}

export function buildAuditEntry(
  actor: Actor,
  action: string,
  opts: { targetId?: string | null; result?: AuditResult; meta?: Record<string, unknown> },
  info: { ip: string | null; userAgent: string | null },
  now = new Date(),
): AuditEntry {
  const ts = now.toISOString();
  return {
    _id: `audit:${ts}:${randomUUID()}`,
    type: "audit",
    ts,
    actorType: actor.type,
    actorId: actor.id,
    actorEmail: actor.email ?? null,
    action,
    targetId: opts.targetId ?? null,
    result: opts.result ?? "ok",
    ip: info.ip,
    userAgent: info.userAgent,
    meta: opts.meta ?? {},
  };
}

/**
 * Write an audit entry. Throws on failure — callers that must not proceed
 * without an audit record (downloads, mutations) should let it propagate.
 */
export async function logEvent(
  actor: Actor,
  action: string,
  opts: { targetId?: string | null; result?: AuditResult; meta?: Record<string, unknown> } = {},
) {
  const entry = buildAuditEntry(actor, action, opts, await requestInfo());
  await putDoc(DB.audit, entry);
  return entry;
}

/** Best-effort variant for page views: never breaks rendering. */
export async function logEventSoft(...args: Parameters<typeof logEvent>) {
  try {
    await logEvent(...args);
  } catch (e) {
    console.error("[audit] failed to write entry", args[1], e);
  }
}

export type AuditQuery = {
  actorType?: string;
  action?: string;
  actorId?: string;
  targetId?: string;
  result?: string;
  from?: string;
  to?: string;
  limit?: number;
  bookmark?: string;
};

export async function queryAudit(q: AuditQuery) {
  const ts: Record<string, string> = { $gt: "" };
  if (q.from) ts.$gte = q.from;
  if (q.to) ts.$lte = q.to;
  const selector: Record<string, unknown> = { type: "audit", ts };
  if (q.actorType) selector.actorType = q.actorType;
  if (q.action) selector.action = q.action.endsWith("*") ? { $regex: `^${q.action.slice(0, -1).replace(/\./g, "\\.")}` } : q.action;
  if (q.actorId) selector.actorId = q.actorId;
  if (q.targetId) selector.targetId = q.targetId;
  if (q.result) selector.result = q.result;
  return find<AuditEntry>(DB.audit, selector, {
    sort: [{ type: "desc" }, { ts: "desc" }],
    limit: q.limit ?? 100,
    bookmark: q.bookmark,
  });
}
