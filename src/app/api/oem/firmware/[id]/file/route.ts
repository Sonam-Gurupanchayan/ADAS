import { createHash } from "node:crypto";
import { Readable, Transform } from "node:stream";
import type { ReadableStream as NodeWebStream } from "node:stream/web";
import { NextResponse } from "next/server";
import { logEvent } from "@/lib/audit";
import { DB, putAttachmentStream } from "@/lib/couch";
import { env } from "@/lib/env";
import { oemOrNull } from "@/lib/guards";
import { EDITABLE, getFirmware, setFirmwareFile } from "@/lib/repo/firmware";
import { FIRMWARE_ATTACHMENT } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 900;

class TooLarge extends Error {}

// Streams the request body straight into a CouchDB attachment, hashing as it goes.
// Nothing is buffered in memory, so large images are fine.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await oemOrNull();
  if (!ctx) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const fw = await getFirmware(id);
  if (!fw || fw.orgId !== ctx.orgId) {
    await logEvent(ctx.actor, "firmware.upload", { targetId: id, result: "denied", meta: { reason: "not_owner" } });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!EDITABLE.includes(fw.status) || !fw._rev) {
    return NextResponse.json({ error: `Can't replace the file while the release is ${fw.status}.` }, { status: 409 });
  }

  const rawName = req.headers.get("x-file-name");
  const fileName = (rawName ? decodeURIComponent(rawName) : "firmware.bin").replace(/[\\/\0\r\n"]/g, "_").slice(0, 200);
  const declared = req.headers.get("content-length");
  const length = declared ? Number(declared) : undefined;
  const max = env.maxUploadBytes;
  if (length !== undefined && (!Number.isFinite(length) || length > max)) {
    return NextResponse.json({ error: `File exceeds the ${Math.round(max / 1048576)} MB limit.` }, { status: 413 });
  }
  if (length === 0 || !req.body) return NextResponse.json({ error: "Empty file" }, { status: 400 });

  const hash = createHash("sha256");
  let size = 0;
  const meter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      size += chunk.length;
      if (size > max) return cb(new TooLarge());
      hash.update(chunk);
      cb(null, chunk);
    },
  });
  const source = Readable.fromWeb(req.body as unknown as NodeWebStream<Uint8Array>);
  source.on("error", (e) => meter.destroy(e));
  source.pipe(meter);

  try {
    await putAttachmentStream(DB.files, fw._id, fw._rev, FIRMWARE_ATTACHMENT, meter, length);
  } catch (e) {
    const tooLarge = e instanceof TooLarge;
    await logEvent(ctx.actor, "firmware.upload", {
      targetId: id,
      result: "error",
      meta: { reason: tooLarge ? "too_large" : String((e as Error).message), fileName },
    });
    return NextResponse.json(
      { error: tooLarge ? "File exceeds the upload limit." : "Upload failed. Please retry." },
      { status: tooLarge ? 413 : 502 },
    );
  }

  const file = {
    name: fileName,
    size,
    sha256: hash.digest("hex"),
    contentType: "application/octet-stream",
  };
  await setFirmwareFile(fw._id, file);
  await logEvent(ctx.actor, "firmware.upload", { targetId: id, meta: { ...file } });
  return NextResponse.json({ ok: true, file });
}
