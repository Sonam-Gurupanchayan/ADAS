import { describe, expect, it } from "vitest";
import { firmwareImageUrl, sniffImageType } from "@/lib/image";

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

describe("sniffImageType", () => {
  it("recognises JPEG, PNG and WebP by their signatures", () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffImageType(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WEBP")))).toBe("image/webp");
  });
  it("rejects SVG, HTML, other RIFF files and truncated input", () => {
    expect(sniffImageType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("<!doctype html><script>alert(1)</script>"))).toBeNull();
    expect(sniffImageType(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WAVE")))).toBeNull();
    expect(sniffImageType(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });
});

describe("firmwareImageUrl", () => {
  it("is null without a photo and cache-busts by hash", () => {
    expect(firmwareImageUrl({ _id: "fw:1", image: null })).toBeNull();
    expect(firmwareImageUrl({ _id: "fw:1" })).toBeNull();
    const url = firmwareImageUrl({
      _id: "fw:1",
      image: { contentType: "image/webp", size: 10, sha256: "abcdef0123456789ff", updatedAt: "" },
    });
    expect(url).toBe("/api/firmware/fw%3A1/image?v=abcdef012345");
  });
});
