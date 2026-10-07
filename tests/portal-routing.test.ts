import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentOidc: vi.fn(),
  requireOem: vi.fn(),
  listFirmwareForOrg: vi.fn(),
}));

vi.mock("@/lib/guards", () => ({
  currentOidc: mocks.currentOidc,
  requireOem: mocks.requireOem,
}));
vi.mock("@/auth", () => ({ signOut: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logEventSoft: vi.fn() }));
vi.mock("@/lib/repo/firmware", () => ({ listFirmwareForOrg: mocks.listFirmwareForOrg }));
vi.mock("@/lib/repo/directory", () => ({ getOrg: vi.fn(), listModels: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));

import PortalHome from "@/app/portal/(app)/page";
import PendingPage from "@/app/portal/pending/page";

describe("portal landing routes", () => {
  beforeEach(() => vi.resetAllMocks());

  it("sends an admin with an active supplier record to the admin home", async () => {
    mocks.requireOem.mockResolvedValue({ isAdmin: true, orgId: "org:example" });
    await expect(PortalHome()).rejects.toThrow("redirect:/admin");
    expect(mocks.listFirmwareForOrg).not.toHaveBeenCalled();
  });

  it("keeps suppliers on the supplier data path", async () => {
    mocks.requireOem.mockResolvedValue({ isAdmin: false, orgId: "org:example" });
    mocks.listFirmwareForOrg.mockRejectedValue(new Error("supplier-data-path"));
    await expect(PortalHome()).rejects.toThrow("supplier-data-path");
    expect(mocks.listFirmwareForOrg).toHaveBeenCalledWith("org:example");
  });

  it("sends an admin without a supplier organisation away from pending approval", async () => {
    mocks.currentOidc.mockResolvedValue({ isAdmin: true, oem: { status: "pending" } });
    await expect(PendingPage()).rejects.toThrow("redirect:/admin");
  });

  it("sends an approved supplier to the supplier home", async () => {
    mocks.currentOidc.mockResolvedValue({
      isAdmin: false,
      oem: { status: "active", orgId: "org:example" },
    });
    await expect(PendingPage()).rejects.toThrow("redirect:/portal");
  });

  it("requires authentication on the pending page", async () => {
    mocks.currentOidc.mockResolvedValue(null);
    await expect(PendingPage()).rejects.toThrow("redirect:/portal/signin");
  });
});