export type OemUserStatus = "pending" | "active" | "disabled";
export type SensorUserStatus = "invited" | "active" | "disabled";
export type FirmwareStatus = "draft" | "pending" | "published" | "rejected" | "withdrawn";
export type Severity = "low" | "medium" | "high";

export type OemUser = {
  _id: string; // oem:<sub>
  _rev?: string;
  type: "oem_user";
  sub: string;
  email: string;
  name: string;
  orgId: string | null;
  status: OemUserStatus;
  createdAt: string;
  lastLoginAt: string;
};

export type Org = {
  _id: string; // org:<slug>
  _rev?: string;
  type: "org";
  name: string;
  createdAt: string;
};

export type SensorModel = {
  _id: string; // model:<slug>
  _rev?: string;
  type: "sensor_model";
  name: string;
  manufacturerOrgId: string | null;
  description: string;
  createdAt: string;
};

export type Group = {
  _id: string; // group:<slug>
  _rev?: string;
  type: "group";
  name: string;
  description: string;
  modelIds: string[];
  createdAt: string;
};

export type SensorUser = {
  _id: string; // su:<uuid>
  _rev?: string;
  type: "sensor_user";
  email: string;
  name: string;
  groupIds: string[];
  status: SensorUserStatus;
  createdAt: string;
  createdBy: string;
  lastLoginAt: string | null;
};

export type Passkey = {
  _id: string; // cred:<credentialId>
  _rev?: string;
  type: "passkey";
  userId: string;
  credentialId: string;
  publicKey: string; // base64url
  counter: number;
  transports: string[];
  deviceType: string;
  backedUp: boolean;
  deviceName: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export type EnrolToken = {
  _id: string; // enrol:<sha256(token)>
  _rev?: string;
  type: "enrol_token";
  userId: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  createdBy: string;
};

export type KnownIssue = { title: string; severity: Severity; workaround: string };

export type FirmwareFile = {
  name: string;
  size: number;
  sha256: string;
  contentType: string;
};

export type FirmwareImage = {
  contentType: "image/jpeg" | "image/png" | "image/webp";
  size: number;
  sha256: string;
  updatedAt: string;
};

export type Firmware = {
  _id: string; // fw:<uuid>
  _rev?: string;
  _attachments?: Record<string, unknown>;
  type: "firmware";
  orgId: string;
  title: string;
  version: string;
  modelIds: string[];
  releaseNotes: string;
  installationNotes: string;
  knownIssues: KnownIssue[];
  status: FirmwareStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  uploadedAt: string | null;
  submittedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewComment: string | null;
  publishedAt: string | null;
  file: FirmwareFile | null;
  /** Photo of the sensor, shown to sensor users. Absent on releases created before photos existed. */
  image?: FirmwareImage | null;
};

export type ActorType = "oem" | "admin" | "sensor" | "anon";
export type AuditResult = "ok" | "denied" | "error";

export type AuditEntry = {
  _id: string; // audit:<iso ts>:<uuid>
  _rev?: string;
  type: "audit";
  ts: string;
  actorType: ActorType;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  targetId: string | null;
  result: AuditResult;
  ip: string | null;
  userAgent: string | null;
  meta: Record<string, unknown>;
};

export const FIRMWARE_ATTACHMENT = "binary";
export const IMAGE_ATTACHMENT = "image";
