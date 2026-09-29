#!/usr/bin/env node
// Idempotent setup of Firmware Hub inside an existing CouchDB database (default "adas_dist").
//   npm run couch:init
// It does NOT create the database or change its _security object — it only adds Mango indexes
// and the append-only audit validation design doc, then reports on server/database settings.
//
// Env: COUCHDB_URL, COUCHDB_DB, and either COUCHDB_ADMIN_USER/PASSWORD or COUCHDB_USER/PASSWORD
// (whichever is set is used; the account must be an admin of the database to write design docs).

const url = (process.env.COUCHDB_URL || "").replace(/\/+$/, "");
const db = process.env.COUCHDB_DB || "adas_dist";
const user = process.env.COUCHDB_ADMIN_USER || process.env.COUCHDB_USER;
const pass = process.env.COUCHDB_ADMIN_USER ? process.env.COUCHDB_ADMIN_PASSWORD : process.env.COUCHDB_PASSWORD;
const appUser = process.env.COUCHDB_USER;
const maxUploadMb = Number(process.env.MAX_UPLOAD_MB || 500);

if (!url || !user || !pass) {
  console.error("Set COUCHDB_URL and COUCHDB_USER/COUCHDB_PASSWORD (or COUCHDB_ADMIN_USER/COUCHDB_ADMIN_PASSWORD).");
  process.exit(1);
}

const auth = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
const dbPath = `/${encodeURIComponent(db)}`;

async function couch(method, path, body) {
  const res = await fetch(url + path, {
    method,
    headers: { Authorization: auth, "Content-Type": "application/json", Accept: "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

// Every index leads with `type` because all document kinds share one database.
const INDEXES = {
  "type-createdAt": ["type", "createdAt"], // directory listings
  "type-email": ["type", "email"], // sensor user lookup
  "type-userId": ["type", "userId"], // passkeys by user
  "type-org-updatedAt": ["type", "orgId", "updatedAt"], // supplier's firmware
  "type-status-submittedAt": ["type", "status", "submittedAt"], // review queue
  "type-status-publishedAt": ["type", "status", "publishedAt"], // sensor library
  "type-updatedAt": ["type", "updatedAt"], // admin: all firmware
  "type-ts": ["type", "ts"], // audit log
};

// Audit entries (type "audit") can be created but never modified or deleted.
const validate = function (newDoc, oldDoc) {
  if (newDoc._id.indexOf("_design/") === 0) return;
  if (oldDoc && oldDoc.type === "audit") throw { forbidden: "The audit log is append-only." };
  if (newDoc.type === "audit" && (!newDoc.ts || !newDoc.action)) throw { forbidden: "Audit entries need ts and action." };
}.toString();

function parseSize(v) {
  if (v === undefined || v === null || v === "infinity") return Infinity;
  const n = Number(v);
  return Number.isFinite(n) ? n : Infinity;
}

async function main() {
  const info = await couch("GET", "/");
  if (info.status !== 200) throw new Error(`Cannot reach CouchDB at ${url}: ${info.status} ${JSON.stringify(info.data)}`);
  console.log(`CouchDB ${info.data.version} at ${url}`);
  if (!String(info.data.version).startsWith("3.")) console.warn("  WARNING: Firmware Hub is built for CouchDB 3.x");

  const dbInfo = await couch("GET", dbPath);
  if (dbInfo.status !== 200) throw new Error(`Database "${db}" is not accessible as ${user}: ${dbInfo.status} ${JSON.stringify(dbInfo.data)}`);
  console.log(`Database ${db}: ${dbInfo.data.doc_count} docs`);

  console.log("Indexes");
  for (const [name, fields] of Object.entries(INDEXES)) {
    const r = await couch("POST", `${dbPath}/_index`, { index: { fields }, ddoc: `fwhub-idx-${name}`, name, type: "json" });
    if (r.status >= 300) throw new Error(`Index ${name}: ${r.status} ${JSON.stringify(r.data)} — is ${user} an admin of ${db}?`);
    console.log(`  ${name}: ${r.data.result}`);
  }

  console.log("Design docs");
  const id = "_design/fwhub-audit";
  const existing = await couch("GET", `${dbPath}/${id}`);
  const doc = { _id: id, validate_doc_update: validate };
  if (existing.status === 200) doc._rev = existing.data._rev;
  const r = await couch("PUT", `${dbPath}/${id}`, doc);
  if (r.status >= 300) throw new Error(`Design doc: ${r.status} ${JSON.stringify(r.data)} — is ${user} an admin of ${db}?`);
  console.log(`  ${id} saved (append-only audit log)`);

  console.log("Checks");
  const sec = await couch("GET", `${dbPath}/_security`);
  if (sec.status === 200) {
    const members = sec.data.members ?? {};
    const open = !(members.names?.length || members.roles?.length);
    if (open) console.warn(`  WARNING: ${db} has no members set — any authenticated (or anonymous) user may be able to read it. Restrict it to ${appUser}.`);
    else if (appUser && !members.names?.includes(appUser)) console.log(`  note: ${appUser} is not listed by name in members (fine if granted via a role).`);
    else console.log(`  _security: members restricted`);
  } else {
    console.log(`  _security: not readable as ${user} (${sec.status}) — skipped`);
  }

  const need = maxUploadMb * 1024 * 1024;
  for (const [section, key] of [
    ["chttpd", "max_http_request_size"],
    ["couchdb", "max_attachment_size"],
  ]) {
    const c = await couch("GET", `/_node/_local/_config/${section}/${key}`);
    if (c.status === 401 || c.status === 403) {
      console.log(`  [${section}] ${key}: needs server admin to read — make sure it is ≥ ${maxUploadMb} MB`);
      continue;
    }
    const value = c.status === 200 ? c.data : undefined;
    const shown = value === undefined ? "(default)" : value;
    if (parseSize(value) < need) {
      console.warn(`  WARNING [${section}] ${key} = ${shown} is below MAX_UPLOAD_MB (${maxUploadMb} MB). Raise it:`);
      console.warn(`    curl -u admin -X PUT ${url}/_node/_local/_config/${section}/${key} -d '"${need}"'`);
    } else {
      console.log(`  [${section}] ${key} = ${shown} ok`);
    }
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
