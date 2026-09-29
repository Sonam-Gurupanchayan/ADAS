import { describe, expect, it } from "vitest";
import { canSensorUserAccess, entitledModelIds } from "@/lib/access";

const groups = [
  { _id: "group:north", modelIds: ["model:radar-a", "model:cam-b"] },
  { _id: "group:south", modelIds: ["model:cam-b", "model:lidar-c"] },
  { _id: "group:other", modelIds: ["model:secret"] },
];

describe("entitledModelIds", () => {
  it("unions models across the user's groups without duplicates", () => {
    expect(entitledModelIds({ groupIds: ["group:north", "group:south"] }, groups).sort()).toEqual(["model:cam-b", "model:lidar-c", "model:radar-a"]);
  });
  it("ignores groups the user is not in and unknown group ids", () => {
    expect(entitledModelIds({ groupIds: ["group:missing"] }, groups)).toEqual([]);
  });
});

describe("canSensorUserAccess", () => {
  const user = { status: "active" as const, groupIds: ["group:north"] };
  const fw = { status: "published" as const, modelIds: ["model:radar-a"] };

  it("allows published firmware for an entitled model", () => {
    expect(canSensorUserAccess(user, groups, fw)).toBe(true);
  });
  it("allows when any one of several models matches", () => {
    expect(canSensorUserAccess(user, groups, { ...fw, modelIds: ["model:x", "model:cam-b"] })).toBe(true);
  });
  it("denies firmware for models outside the user's groups", () => {
    expect(canSensorUserAccess(user, groups, { ...fw, modelIds: ["model:secret"] })).toBe(false);
  });
  it.each(["draft", "pending", "rejected", "withdrawn"] as const)("denies %s firmware", (status) => {
    expect(canSensorUserAccess(user, groups, { ...fw, status })).toBe(false);
  });
  it.each(["invited", "disabled"] as const)("denies %s users", (status) => {
    expect(canSensorUserAccess({ ...user, status }, groups, fw)).toBe(false);
  });
});
