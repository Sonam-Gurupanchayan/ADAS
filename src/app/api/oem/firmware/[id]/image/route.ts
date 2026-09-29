import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { logEvent } from "@/lib/audit";
import { DB, deleteAttachment, putAttachmentStream } from "@/lib/couch";
import { oemOrNull } from "@/lib/guards";
import { MAX_IMAGE_BYTES, sniffImageType } from "@/lib/image";
import { EDITABLE, getFirmware, setFirmwareImage } from "@/lib/repo/firmware";
import { IMAGE_ATTACHMENT } from "@/lib/types";

export const runtime = "nodejs";

const tooLarge = () => NextResponse.json({ error: "Photos can be up to 5 MB." }, { status: 413 });

/** Read the body into memory, giving up as soon as it passes the limit. Photos are small. */
async function readLimited(body: ReadableStream<Uint8Array>, max: number) {
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

async function editableRelease(action: string, id: string) {
  const ctx = await oemOrNull();
  if (!ctx) return { error: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  const fw = await getFirmware(id);
  if (!fw || fw.orgId !== ctx.orgId) {
    await logEvent(ctx.actor, action, { targetId: id, result: "denied", meta: { reason: "not_owner" } });
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  if (!EDITABLE.includes(fw.status) || !fw._rev) {
    return { error: NextResponse.json({ error: `Can't change the photo while the release is ${fw.status}.` }, { status: 409 }) };
  }
  return { ctx, fw: { ...fw, _rev: fw._rev } };
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await editableRelease("firmware.image_upload", id);
  if ("error" in r) return r.error;
  const { ctx, fw } = r;

  const declared = Number(req.headers.get("content-length") ?? NaN);
  if (declared > MAX_IMAGE_BYTES) return tooLarge();
  if (!req.body) return NextResponse.json({ error: "Empty file" }, { status: 400 });
  const bytes = await readLimited(req.body, MAX_IMAGE_BYTES);
  if (!bytes) return tooLarge();
  if (bytes.length === 0) return NextResponse.json({ error: "Empty file" }, { status: 400 });

  const contentType = sniffImageType(bytes);
  if (!contentType) {
    await logEvent(ctx.actor, "firmware.image_upload", { targetId: id, result: "denied", meta: { reason: "bad_type" } });
    return NextResponse.json({ error: "Use a JPEG, PNG or WebP photo." }, { status: 415 });
  }

  try {
    await putAttachmentStream(DB.files, fw._id, fw._rev, IMAGE_ATTACHMENT, Readable.from(bytes), bytes.length, contentType);
  } catch (e) {
    await logEvent(ctx.actor, "firmware.image_upload", { targetId: id, result: "error", meta: { reason: String((e as Error).message) } });
    return NextResponse.json({ error: "Upload failed. Please retry." }, { status: 502 });
  }

  const image = {
    contentType,
    size: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    updatedAt: new Date().toISOString(),
  };
  await setFirmwareImage(fw._id, image);
  await logEvent(ctx.actor, "firmware.image_upload", { targetId: id, meta: { ...image } });
  return NextResponse.json({ ok: true, image });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await editableRelease("firmware.image_remove", id);
  if ("error" in r) return r.error;
  const { ctx, fw } = r;

  try {
    await deleteAttachment(DB.files, fw._id, fw._rev, IMAGE_ATTACHMENT);
  } catch (e) {
    await logEvent(ctx.actor, "firmware.image_remove", { targetId: id, result: "error", meta: { reason: String((e as Error).message) } });
    return NextResponse.json({ error: "Could not remove the photo. Please retry." }, { status: 502 });
  }
  await setFirmwareImage(fw._id, null);
  await logEvent(ctx.actor, "firmware.image_remove", { targetId: id });
  return NextResponse.json({ ok: true });
}
