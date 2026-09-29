import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { DB, deleteDoc, find, getDoc, getMany, putDoc, updateDoc } from "../couch";
import type { EnrolToken, Group, OemUser, Org, Passkey, SensorModel, SensorUser } from "../types";

const now = () => new Date().toISOString();

export function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || randomUUID().slice(0, 8)
  );
}

async function listByType<T>(type: string): Promise<T[]> {
  const { docs } = await find<T>(
    DB.meta,
    { type, createdAt: { $gt: null } },
    { sort: [{ type: "asc" }, { createdAt: "asc" }], limit: 5000 },
  );
  return docs;
}

async function createUnique<T extends { _id: string }>(prefix: string, name: string, build: (id: string) => T) {
  const base = `${prefix}:${slugify(name)}`;
  for (let i = 0; i < 20; i++) {
    const id = i === 0 ? base : `${base}-${i + 1}`;
    if (!(await getDoc(DB.meta, id))) return putDoc(DB.meta, build(id));
  }
  throw new Error("Could not allocate id");
}

// ---------- Orgs ----------
export const listOrgs = () => listByType<Org>("org");
export const getOrg = (id: string) => getDoc<Org>(DB.meta, id);
export const createOrg = (name: string) =>
  createUnique<Org>("org", name, (id) => ({ _id: id, type: "org", name, createdAt: now() }));
export const renameOrg = (id: string, name: string) =>
  updateDoc<Org>(DB.meta, id, (d) => ({ ...d, name }));

// ---------- Sensor models ----------
export const listModels = () => listByType<SensorModel>("sensor_model");
export const getModel = (id: string) => getDoc<SensorModel>(DB.meta, id);
export const createModel = (input: { name: string; manufacturerOrgId: string | null; description: string }) =>
  createUnique<SensorModel>("model", input.name, (id) => ({
    _id: id,
    type: "sensor_model",
    ...input,
    createdAt: now(),
  }));
export const updateModel = (
  id: string,
  input: { name: string; manufacturerOrgId: string | null; description: string },
) => updateDoc<SensorModel>(DB.meta, id, (d) => ({ ...d, ...input }));

// ---------- Groups ----------
export const listGroups = () => listByType<Group>("group");
export const getGroup = (id: string) => getDoc<Group>(DB.meta, id);
export const createGroup = (input: { name: string; description: string; modelIds: string[] }) =>
  createUnique<Group>("group", input.name, (id) => ({ _id: id, type: "group", ...input, createdAt: now() }));
export const updateGroup = (id: string, input: { name: string; description: string; modelIds: string[] }) =>
  updateDoc<Group>(DB.meta, id, (d) => ({ ...d, ...input }));
export async function deleteGroup(id: string) {
  const g = await getGroup(id);
  if (g?._rev) await deleteDoc(DB.meta, id, g._rev);
  // Remove the group from any members.
  for (const u of await listSensorUsers()) {
    if (u.groupIds.includes(id)) {
      await updateDoc<SensorUser>(DB.meta, u._id, (d) => ({ ...d, groupIds: d.groupIds.filter((g) => g !== id) }));
    }
  }
}

// ---------- OEM users ----------
export const listOemUsers = () => listByType<OemUser>("oem_user");
export const getOemUser = (sub: string) => getDoc<OemUser>(DB.meta, `oem:${sub}`);
export const getOemUserById = (id: string) => getDoc<OemUser>(DB.meta, id);

export async function upsertOemUserOnLogin(p: { sub: string; email: string; name: string }) {
  const id = `oem:${p.sub}`;
  const existing = await getDoc<OemUser>(DB.meta, id);
  if (existing) {
    return updateDoc<OemUser>(DB.meta, id, (d) => ({ ...d, email: p.email, name: p.name, lastLoginAt: now() }));
  }
  return putDoc<OemUser>(DB.meta, {
    _id: id,
    type: "oem_user",
    sub: p.sub,
    email: p.email,
    name: p.name,
    orgId: null,
    status: "pending",
    createdAt: now(),
    lastLoginAt: now(),
  });
}

export const setOemUser = (id: string, patch: Pick<OemUser, "orgId" | "status">) =>
  updateDoc<OemUser>(DB.meta, id, (d) => ({ ...d, ...patch }));

// ---------- Sensor users ----------
export const listSensorUsers = () => listByType<SensorUser>("sensor_user");
export const getSensorUser = (id: string) => getDoc<SensorUser>(DB.meta, id);

export async function findSensorUserByEmail(email: string) {
  const { docs } = await find<SensorUser>(DB.meta, { type: "sensor_user", email: email.toLowerCase() }, { limit: 1 });
  return docs[0] ?? null;
}

export async function createSensorUser(input: { email: string; name: string; groupIds: string[] }, createdBy: string) {
  return putDoc<SensorUser>(DB.meta, {
    _id: `su:${randomUUID()}`,
    type: "sensor_user",
    email: input.email.toLowerCase(),
    name: input.name,
    groupIds: input.groupIds,
    status: "invited",
    createdAt: now(),
    createdBy,
    lastLoginAt: null,
  });
}

export const updateSensorUser = (id: string, patch: Partial<Pick<SensorUser, "name" | "groupIds" | "status" | "lastLoginAt">>) =>
  updateDoc<SensorUser>(DB.meta, id, (d) => ({ ...d, ...patch }));

// ---------- Passkeys ----------
export const getPasskey = (credentialId: string) => getDoc<Passkey>(DB.meta, `cred:${credentialId}`);

export async function listPasskeys(userId: string) {
  const { docs } = await find<Passkey>(DB.meta, { type: "passkey", userId }, { limit: 100 });
  return docs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export const savePasskey = (p: Omit<Passkey, "_id" | "type" | "createdAt" | "lastUsedAt">) =>
  putDoc<Passkey>(DB.meta, {
    _id: `cred:${p.credentialId}`,
    type: "passkey",
    ...p,
    createdAt: now(),
    lastUsedAt: null,
  });

export const touchPasskey = (credentialId: string, counter: number) =>
  updateDoc<Passkey>(DB.meta, `cred:${credentialId}`, (d) => ({ ...d, counter, lastUsedAt: now() }));

export async function deletePasskey(credentialId: string, userId: string) {
  const p = await getPasskey(credentialId);
  if (!p || p.userId !== userId || !p._rev) return false;
  await deleteDoc(DB.meta, p._id, p._rev);
  return true;
}

// ---------- Enrolment tokens ----------
const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export async function createEnrolToken(userId: string, createdBy: string, ttlHours = 72) {
  const raw = randomBytes(32).toString("base64url");
  await putDoc<EnrolToken>(DB.meta, {
    _id: `enrol:${hashToken(raw)}`,
    type: "enrol_token",
    userId,
    expiresAt: new Date(Date.now() + ttlHours * 3600_000).toISOString(),
    usedAt: null,
    createdAt: now(),
    createdBy,
  });
  return raw;
}

/** Returns the token doc if it is unused and unexpired. */
export async function checkEnrolToken(raw: string) {
  if (!raw || raw.length > 100) return null;
  const t = await getDoc<EnrolToken>(DB.meta, `enrol:${hashToken(raw)}`);
  if (!t || t.usedAt || new Date(t.expiresAt) < new Date()) return null;
  return t;
}

export const consumeEnrolToken = (id: string) =>
  updateDoc<EnrolToken>(DB.meta, id, (d) => (d.usedAt ? null : { ...d, usedAt: now() }));

export { getMany };
