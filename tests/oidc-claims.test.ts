import { describe, expect, it } from "vitest";
import { isAdminProfile, readClaim } from "@/lib/oidc-claims";

describe("OIDC admin claim", () => {
  it("reads dotted claim paths", () => {
    expect(readClaim({ realm_access: { roles: ["a", "b"] } }, "realm_access.roles")).toEqual(["a", "b"]);
    expect(readClaim({}, "realm_access.roles")).toBeUndefined();
  });
  it("matches array claims", () => {
    expect(isAdminProfile({ groups: ["staff", "firmware-admins"] }, "groups", "firmware-admins")).toBe(true);
    expect(isAdminProfile({ groups: ["staff"] }, "groups", "firmware-admins")).toBe(false);
  });
  it("matches space- or comma-separated string claims exactly", () => {
    expect(isAdminProfile({ roles: "user firmware-admins" }, "roles", "firmware-admins")).toBe(true);
    expect(isAdminProfile({ roles: "firmware-admins-readonly" }, "roles", "firmware-admins")).toBe(false);
  });
  it("is false when the claim is missing", () => {
    expect(isAdminProfile({ sub: "x" }, "groups", "firmware-admins")).toBe(false);
  });
  it("accepts any of several comma-separated values", () => {
    expect(isAdminProfile({ groups: ["ops"] }, "groups", "firmware-admins, ops")).toBe(true);
    expect(isAdminProfile({ groups: ["staff"] }, "groups", "firmware-admins, ops")).toBe(false);
  });
  it("matches admin emails case-insensitively, only when verified", () => {
    const admins = "alice@example.com, Bob@Example.com";
    expect(isAdminProfile({ email: "bob@example.com", email_verified: true }, "email", admins)).toBe(true);
    expect(isAdminProfile({ email: "ALICE@example.com", email_verified: "true" }, "email", admins)).toBe(true);
    expect(isAdminProfile({ email: "alice@example.com", email_verified: false }, "email", admins)).toBe(false);
    expect(isAdminProfile({ email: "alice@example.com" }, "email", admins)).toBe(false);
    expect(isAdminProfile({ email: "carol@example.com", email_verified: true }, "email", admins)).toBe(false);
  });
});
