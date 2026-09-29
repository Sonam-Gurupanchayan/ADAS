import { describe, expect, it } from "vitest";
import { buildAuditEntry } from "@/lib/audit";
import { canTransition } from "@/lib/repo/firmware";
import { firmwareInputSchema, formToObject } from "@/lib/schemas";

const file = { name: "fw.bin", size: 10, sha256: "ab", contentType: "application/octet-stream" };

describe("firmware workflow", () => {
  it("only submits drafts/rejected releases that have a file", () => {
    expect(canTransition({ status: "draft", file }, "submit")).toBe(true);
    expect(canTransition({ status: "rejected", file }, "submit")).toBe(true);
    expect(canTransition({ status: "draft", file: null }, "submit")).toBe(false);
    expect(canTransition({ status: "pending", file }, "submit")).toBe(false);
  });
  it("only reviews pending releases", () => {
    expect(canTransition({ status: "pending", file }, "approve")).toBe(true);
    expect(canTransition({ status: "pending", file }, "reject")).toBe(true);
    expect(canTransition({ status: "draft", file }, "approve")).toBe(false);
    expect(canTransition({ status: "published", file }, "approve")).toBe(false);
  });
  it("withdraws and republishes", () => {
    expect(canTransition({ status: "published", file }, "withdraw")).toBe(true);
    expect(canTransition({ status: "withdrawn", file }, "republish")).toBe(true);
    expect(canTransition({ status: "pending", file }, "withdraw")).toBe(false);
  });
});

describe("firmware input validation", () => {
  const base = { title: "Stability fix", version: "2.4.1", modelIds: ["model:radar"], releaseNotes: "", installationNotes: "", knownIssues: [] };
  it("accepts a valid release", () => {
    expect(firmwareInputSchema.safeParse(base).success).toBe(true);
  });
  it("requires at least one model", () => {
    expect(firmwareInputSchema.safeParse({ ...base, modelIds: [] }).success).toBe(false);
  });
  it("rejects versions with path characters", () => {
    expect(firmwareInputSchema.safeParse({ ...base, version: "../1.0" }).success).toBe(false);
  });
  it("validates known issue severity", () => {
    expect(firmwareInputSchema.safeParse({ ...base, knownIssues: [{ title: "x", severity: "critical", workaround: "" }] }).success).toBe(false);
  });
  it("collects repeated form fields into arrays", () => {
    const fd = new FormData();
    fd.append("title", "t");
    fd.append("modelIds", "model:a");
    fd.append("modelIds", "model:b");
    expect(formToObject(fd, ["modelIds", "groupIds"])).toEqual({ title: "t", modelIds: ["model:a", "model:b"], groupIds: [] });
  });
});

describe("audit entries", () => {
  it("are typed, time-ordered and carry request info", () => {
    const e = buildAuditEntry(
      { type: "sensor", id: "su:1", email: "a@b.c" },
      "firmware.download",
      { targetId: "fw:1", meta: { version: "1.0" } },
      { ip: "10.0.0.1", userAgent: "UA" },
      new Date("2026-01-02T03:04:05.000Z"),
    );
    expect(e._id.startsWith("audit:2026-01-02T03:04:05.000Z:")).toBe(true);
    expect(e).toMatchObject({ type: "audit", actorType: "sensor", actorId: "su:1", action: "firmware.download", targetId: "fw:1", result: "ok", ip: "10.0.0.1" });
  });
});
