import "server-only";
import { randomUUID } from "node:crypto";
import { DB, find, getDoc, putDoc, updateDoc } from "../couch";
import type { Firmware, FirmwareFile, FirmwareImage, FirmwareStatus, KnownIssue } from "../types";

const now = () => new Date().toISOString();

export type FirmwareInput = {
  title: string;
  version: string;
  modelIds: string[];
  releaseNotes: string;
  installationNotes: string;
  knownIssues: KnownIssue[];
};

export const getFirmware = (id: string) => getDoc<Firmware>(DB.files, id);

export async function createFirmware(orgId: string, createdBy: string, input: FirmwareInput) {
  return putDoc<Firmware>(DB.files, {
    _id: `fw:${randomUUID()}`,
    type: "firmware",
    orgId,
    ...input,
    status: "draft",
    createdBy,
    createdAt: now(),
    updatedAt: now(),
    uploadedAt: null,
    submittedAt: null,
    reviewedBy: null,
    reviewedAt: null,
    reviewComment: null,
    publishedAt: null,
    file: null,
    image: null,
  });
}

export const EDITABLE: FirmwareStatus[] = ["draft", "rejected"];

/** Metadata edit. Only drafts/rejected releases can be changed; the attachment stub is preserved. */
export const updateFirmwareMeta = (id: string, input: FirmwareInput) =>
  updateDoc<Firmware>(DB.files, id, (d) => (EDITABLE.includes(d.status) ? { ...d, ...input, updatedAt: now() } : null));

export const setFirmwareFile = (id: string, file: FirmwareFile) =>
  updateDoc<Firmware>(DB.files, id, (d) => ({ ...d, file, uploadedAt: now(), updatedAt: now() }));

export const setFirmwareImage = (id: string, image: FirmwareImage | null) =>
  updateDoc<Firmware>(DB.files, id, (d) => ({ ...d, image, updatedAt: now() }));

type Transition = { from: FirmwareStatus[]; to: FirmwareStatus };
export const TRANSITIONS = {
  submit: { from: ["draft", "rejected"], to: "pending" },
  approve: { from: ["pending"], to: "published" },
  reject: { from: ["pending"], to: "rejected" },
  withdraw: { from: ["published"], to: "withdrawn" },
  republish: { from: ["withdrawn"], to: "published" },
} satisfies Record<string, Transition>;
export type TransitionName = keyof typeof TRANSITIONS;

export function canTransition(fw: Pick<Firmware, "status" | "file">, t: TransitionName) {
  const rule: Transition = TRANSITIONS[t];
  if (!rule.from.includes(fw.status)) return false;
  if (t === "submit" && !fw.file) return false;
  return true;
}

export async function transitionFirmware(id: string, t: TransitionName, by: string, comment?: string) {
  return updateDoc<Firmware>(DB.files, id, (d) => {
    if (!canTransition(d, t)) return null;
    const next: Firmware = { ...d, status: TRANSITIONS[t].to, updatedAt: now() };
    if (t === "submit") {
      next.submittedAt = now();
      next.reviewComment = null;
    } else {
      next.reviewedBy = by;
      next.reviewedAt = now();
      next.reviewComment = comment || null;
    }
    if (next.status === "published") next.publishedAt = now();
    return next;
  });
}

export async function listFirmwareForOrg(orgId: string) {
  const { docs } = await find<Firmware>(
    DB.files,
    { type: "firmware", orgId, updatedAt: { $gt: null } },
    { sort: [{ type: "desc" }, { orgId: "desc" }, { updatedAt: "desc" }], limit: 1000 },
  );
  return docs;
}

export async function listFirmwareByStatus(status: FirmwareStatus) {
  const { docs } = await find<Firmware>(
    DB.files,
    { type: "firmware", status, submittedAt: { $gt: null } },
    { sort: [{ type: "asc" }, { status: "asc" }, { submittedAt: "asc" }], limit: 1000 },
  );
  return docs;
}

export async function listAllFirmware(status?: FirmwareStatus) {
  const selector: Record<string, unknown> = { type: "firmware", updatedAt: { $gt: null } };
  if (status) selector.status = status;
  const { docs } = await find<Firmware>(DB.files, selector, { sort: [{ type: "desc" }, { updatedAt: "desc" }], limit: 2000 });
  return docs;
}

export async function listPublishedForModels(modelIds: string[]) {
  if (modelIds.length === 0) return [];
  const { docs } = await find<Firmware>(
    DB.files,
    { type: "firmware", status: "published", publishedAt: { $gt: null }, modelIds: { $elemMatch: { $in: modelIds } } },
    { sort: [{ type: "desc" }, { status: "desc" }, { publishedAt: "desc" }], limit: 2000 },
  );
  return docs;
}
