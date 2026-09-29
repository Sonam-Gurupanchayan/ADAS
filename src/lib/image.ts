import type { Firmware, FirmwareImage } from "./types";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Identify an image by its leading bytes. Only raster formats a browser can't execute
 * are accepted — never SVG, and never on the strength of a client-supplied Content-Type.
 */
export function sniffImageType(bytes: Uint8Array): FirmwareImage["contentType"] | null {
  const at = (i: number, ...sig: number[]) => sig.every((b, n) => bytes[i + n] === b);
  if (bytes.length >= 3 && at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (bytes.length >= 8 && at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  // "RIFF" <size> "WEBP"
  if (bytes.length >= 12 && at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  return null;
}

/** URL of a release's sensor photo; the hash suffix busts browser caches when the photo changes. */
export function firmwareImageUrl(fw: Pick<Firmware, "_id" | "image">) {
  return fw.image ? `/api/firmware/${encodeURIComponent(fw._id)}/image?v=${fw.image.sha256.slice(0, 12)}` : null;
}
