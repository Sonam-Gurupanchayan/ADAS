import "server-only";
import http from "node:http";
import https from "node:https";
import { Readable } from "node:stream";
import { env } from "./env";

// Everything lives in one database (COUCHDB_DB, default "adas_dist"); documents are
// distinguished by their `type` field. The named aliases keep call sites readable.
export const DB = {
  get meta() {
    return env.couchDb;
  },
  get files() {
    return env.couchDb;
  },
  get audit() {
    return env.couchDb;
  },
};

export class CouchError extends Error {
  constructor(
    public status: number,
    public reason: string,
    public path: string,
  ) {
    super(`CouchDB ${status} on ${path}: ${reason}`);
  }
}

export type CouchDoc = { _id: string; _rev?: string };

function authHeader() {
  return "Basic " + Buffer.from(`${env.couchUser}:${env.couchPassword}`).toString("base64");
}

function docPath(db: string, id: string) {
  // Design docs keep their slash; everything else is fully encoded.
  const encId = id.startsWith("_design/")
    ? `_design/${encodeURIComponent(id.slice(8))}`
    : encodeURIComponent(id);
  return `/${encodeURIComponent(db)}/${encId}`;
}

export async function couchFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", authHeader());
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  return fetch(env.couchUrl + path, { ...init, headers, cache: "no-store" });
}

async function json<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await couchFetch(path, init);
  if (!res.ok) {
    let reason = res.statusText;
    try {
      const body = (await res.json()) as { reason?: string; error?: string };
      reason = body.reason || body.error || reason;
    } catch {}
    throw new CouchError(res.status, reason, path);
  }
  return (await res.json()) as T;
}

export async function getDoc<T extends CouchDoc>(db: string, id: string): Promise<T | null> {
  try {
    return await json<T>(docPath(db, id));
  } catch (e) {
    if (e instanceof CouchError && e.status === 404) return null;
    throw e;
  }
}

export async function putDoc<T extends CouchDoc>(db: string, doc: T): Promise<T & { _rev: string }> {
  const res = await json<{ id: string; rev: string }>(docPath(db, doc._id), {
    method: "PUT",
    body: JSON.stringify(doc),
  });
  return { ...doc, _rev: res.rev };
}

/** Read-modify-write with retry on conflict. `fn` returns the new doc, or null to abort. */
export async function updateDoc<T extends CouchDoc>(
  db: string,
  id: string,
  fn: (doc: T) => T | null,
  attempts = 3,
): Promise<T | null> {
  for (let i = 0; i < attempts; i++) {
    const current = await getDoc<T>(db, id);
    if (!current) return null;
    const next = fn(structuredClone(current));
    if (!next) return null;
    try {
      return await putDoc(db, next);
    } catch (e) {
      if (e instanceof CouchError && e.status === 409 && i < attempts - 1) continue;
      throw e;
    }
  }
  return null;
}

export async function deleteDoc(db: string, id: string, rev: string) {
  await json(`${docPath(db, id)}?rev=${encodeURIComponent(rev)}`, { method: "DELETE" });
}

export type FindOptions = {
  sort?: Array<Record<string, "asc" | "desc">>;
  limit?: number;
  skip?: number;
  bookmark?: string;
  fields?: string[];
  use_index?: string | [string, string];
};

export async function find<T>(
  db: string,
  selector: Record<string, unknown>,
  opts: FindOptions = {},
): Promise<{ docs: T[]; bookmark?: string }> {
  return json(`/${encodeURIComponent(db)}/_find`, {
    method: "POST",
    body: JSON.stringify({ selector, limit: 1000, ...opts }),
  });
}

export async function getMany<T extends CouchDoc>(db: string, ids: string[]): Promise<T[]> {
  if (ids.length === 0) return [];
  const res = await json<{ rows: Array<{ doc?: T | null }> }>(
    `/${encodeURIComponent(db)}/_all_docs?include_docs=true`,
    { method: "POST", body: JSON.stringify({ keys: ids }) },
  );
  return res.rows.map((r) => r.doc).filter((d): d is T => !!d);
}

/**
 * Stream a request body into an attachment. Uses node:http so we control
 * Content-Length / chunked encoding precisely.
 */
export function putAttachmentStream(
  db: string,
  id: string,
  rev: string,
  name: string,
  body: Readable,
  contentLength?: number,
  contentType = "application/octet-stream",
): Promise<{ rev: string }> {
  const url = new URL(
    `${env.couchUrl}${docPath(db, id)}/${encodeURIComponent(name)}?rev=${encodeURIComponent(rev)}`,
  );
  const client = url.protocol === "https:" ? https : http;
  const headers: Record<string, string> = {
    Authorization: authHeader(),
    "Content-Type": contentType,
    Accept: "application/json",
  };
  if (contentLength !== undefined) headers["Content-Length"] = String(contentLength);
  else headers["Transfer-Encoding"] = "chunked";

  return new Promise((resolve, reject) => {
    const req = client.request(url, { method: "PUT", headers }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data || "{}");
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) resolve({ rev: parsed.rev });
          else reject(new CouchError(res.statusCode ?? 500, parsed.reason || parsed.error || data, url.pathname));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    body.on("error", (err) => {
      req.destroy(err);
      reject(err);
    });
    body.pipe(req);
  });
}

export async function deleteAttachment(db: string, id: string, rev: string, name: string) {
  const res = await couchFetch(`${docPath(db, id)}/${encodeURIComponent(name)}?rev=${encodeURIComponent(rev)}`, {
    method: "DELETE",
  });
  // 404: already gone, which is the outcome we wanted.
  if (!res.ok && res.status !== 404) throw new CouchError(res.status, await res.text(), `${id}/${name}`);
}

export async function getAttachment(db: string, id: string, name: string, range?: string | null) {
  const headers: Record<string, string> = { Accept: "*/*" };
  if (range) headers.Range = range;
  return couchFetch(`${docPath(db, id)}/${encodeURIComponent(name)}`, { headers });
}
