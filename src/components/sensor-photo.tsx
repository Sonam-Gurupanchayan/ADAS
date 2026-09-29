"use client";

import { Camera, Cpu, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { cn, formatBytes } from "@/lib/format";
import { MAX_IMAGE_BYTES } from "@/lib/image";
import { Alert, Button } from "./ui";

const MAX_EDGE = 1600;

/**
 * Scale the photo down and re-encode it in the browser. This keeps uploads small and drops
 * EXIF metadata (GPS location, camera serials) — the canvas only carries pixels.
 */
async function prepare(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file); // applies EXIF orientation
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const g = canvas.getContext("2d");
  if (!g) throw new Error("no canvas");
  g.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const encode = (type: string, q: number) => new Promise<Blob | null>((ok) => canvas.toBlob(ok, type, q));
  const webp = await encode("image/webp", 0.86);
  // Browsers that can't encode WebP fall back to PNG; prefer JPEG over that, on a white background.
  if (webp?.type === "image/webp") return webp;
  g.globalCompositeOperation = "destination-over";
  g.fillStyle = "#fff";
  g.fillRect(0, 0, canvas.width, canvas.height);
  const jpeg = await encode("image/jpeg", 0.88);
  if (!jpeg) throw new Error("encode failed");
  return jpeg;
}

export function SensorPhotoUpload({ id, src, editable }: { id: string; src: string | null; editable: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const endpoint = `/api/oem/firmware/${encodeURIComponent(id)}/image`;

  async function send(init: RequestInit) {
    const res = await fetch(endpoint, init);
    if (res.ok) return router.refresh();
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setError(body.error ?? `Request failed (${res.status}).`);
  }

  async function upload(file: File) {
    setError(null);
    if (!file.type.startsWith("image/")) return setError("Choose a photo (JPEG, PNG, WebP or HEIC).");
    setBusy("upload");
    try {
      let blob: Blob;
      try {
        blob = await prepare(file);
      } catch {
        return setError("That photo couldn't be read by your browser. Try a JPEG or PNG.");
      }
      if (blob.size > MAX_IMAGE_BYTES) return setError(`The photo is ${formatBytes(blob.size)} after resizing — the limit is 5 MB.`);
      await send({ method: "PUT", body: blob, headers: { "Content-Type": blob.type } });
    } catch {
      setError("Network error during upload.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setError(null);
    setBusy("remove");
    try {
      await send({ method: "DELETE" });
    } catch {
      setError("Network error.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          if (!editable) return;
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          if (!editable) return;
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files[0];
          if (f && !busy) void upload(f);
        }}
        className={cn(
          "relative overflow-hidden rounded-xl border-2 border-dashed transition",
          drag ? "border-brand bg-brand/5" : src ? "border-transparent" : "border-line",
        )}
      >
        {src ? (
          <SensorPhoto src={src} alt="Sensor photo" className="aspect-[4/3] w-full rounded-xl" />
        ) : (
          <div className="grid aspect-[4/3] place-items-center p-6 text-center">
            <div>
              <Camera className="mx-auto size-8 text-fg-subtle" />
              <p className="mt-2 text-sm text-fg-muted">
                {editable ? "Drop a photo of the sensor here" : "No photo"}
              </p>
              {editable && <p className="mt-1 text-xs text-fg-subtle">Resized to {MAX_EDGE}px · location data removed</p>}
            </div>
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 grid place-items-center bg-bg/70 backdrop-blur-sm">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Loader2 className="size-4 animate-spin" /> {busy === "upload" ? "Uploading…" : "Removing…"}
            </p>
          </div>
        )}
      </div>

      {editable && (
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" disabled={!!busy} onClick={() => input.current?.click()}>
            <ImagePlus className="size-4" /> {src ? "Replace photo" : "Choose photo"}
          </Button>
          {src && (
            <Button type="button" variant="ghost" size="sm" disabled={!!busy} onClick={remove}>
              <Trash2 className="size-4" /> Remove
            </Button>
          )}
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
        </div>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}

/**
 * The sensor photo on a neutral backdrop, or a chip icon when there is none. Photos are served
 * from an authenticated route, so they use a plain <img> — the image optimiser would fetch them
 * without the viewer's session cookie.
 */
export function SensorPhoto({ src, alt, className, iconClassName }: { src: string | null; alt: string; className?: string; iconClassName?: string }) {
  if (!src) {
    return (
      <div className={cn("grid place-items-center bg-gradient-to-br from-brand/15 to-brand-2/15 text-brand", className)}>
        <Cpu className={cn("size-5", iconClassName)} />
      </div>
    );
  }
  return (
    <div className={cn("overflow-hidden bg-white ring-1 ring-inset ring-black/5", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" decoding="async" className="size-full object-contain" />
    </div>
  );
}
