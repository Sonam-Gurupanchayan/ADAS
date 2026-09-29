import { NextResponse } from "next/server";
import { canSensorUserAccess } from "@/lib/access";
import { ANON, logEvent, type Actor } from "@/lib/audit";
import { DB, getAttachment } from "@/lib/couch";
import { currentOidc, currentSensor } from "@/lib/guards";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getFirmware } from "@/lib/repo/firmware";
import { FIRMWARE_ATTACHMENT } from "@/lib/types";

export const runtime = "nodejs";

function contentDisposition(name: string) {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

// Sensor users download entitled, published firmware. Admins may download anything
// (for review) and OEMs may download their own org's releases. Every attempt is audited,
// and the download is refused if the audit record can't be written.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const range = req.headers.get("range");

  const sensor = await currentSensor();
  const oidc = sensor ? null : await currentOidc();
  const actor: Actor = sensor?.actor ?? oidc?.actor ?? ANON;

  if (!rateLimit(`dl:${actor.id ?? clientIp(req)}`, 60, 30)) {
    return NextResponse.json({ error: "Too many downloads. Slow down a little." }, { status: 429 });
  }

  const fw = await getFirmware(id);
  let allowed = false;
  if (fw) {
    if (sensor) allowed = canSensorUserAccess(sensor.user, sensor.groups, fw);
    else if (oidc?.isAdmin) allowed = true;
    else if (oidc?.oem?.status === "active" && oidc.oem.orgId === fw.orgId) allowed = true;
  }

  if (!fw || !allowed || !fw.file) {
    await logEvent(actor, "firmware.download", {
      targetId: id,
      result: "denied",
      meta: { reason: !fw ? "not_found" : !allowed ? "not_entitled" : "no_file" },
    });
    const status = actor.type === "anon" ? 401 : fw && allowed ? 404 : 403;
    return NextResponse.json({ error: status === 401 ? "Sign in required" : "Not available" }, { status });
  }

  try {
    await logEvent(actor, "firmware.download", {
      targetId: id,
      meta: { version: fw.version, fileName: fw.file.name, sha256: fw.file.sha256, range: range ?? undefined },
    });
  } catch (e) {
    console.error("[download] audit write failed; refusing download", e);
    return NextResponse.json({ error: "Download temporarily unavailable" }, { status: 503 });
  }

  const upstream = await getAttachment(DB.files, fw._id, FIRMWARE_ATTACHMENT, range);
  if (!upstream.ok || !upstream.body) {
    const status = upstream.status === 416 ? 416 : 502;
    return NextResponse.json({ error: "Could not read firmware" }, { status });
  }

  const headers = new Headers({
    "Content-Type": "application/octet-stream",
    "Content-Disposition": contentDisposition(fw.file.name),
    "X-Checksum-SHA256": fw.file.sha256,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
    "Accept-Ranges": "bytes",
  });
  for (const h of ["content-length", "content-range"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}
