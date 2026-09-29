import { NextResponse } from "next/server";
import { canSensorUserAccess } from "@/lib/access";
import { DB, getAttachment } from "@/lib/couch";
import { currentOidc, currentSensor } from "@/lib/guards";
import { getFirmware } from "@/lib/repo/firmware";
import { IMAGE_ATTACHMENT } from "@/lib/types";

export const runtime = "nodejs";

// Sensor photo for a release. Visible to exactly the people who can see the release:
// entitled sensor users, admins, and the supplier's own org. Not audited per request —
// the page that shows it already records the view.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sensor = await currentSensor();
  const oidc = sensor ? null : await currentOidc();
  if (!sensor && !oidc) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const fw = await getFirmware(id);
  let allowed = false;
  if (fw) {
    if (sensor) allowed = canSensorUserAccess(sensor.user, sensor.groups, fw);
    else if (oidc?.isAdmin) allowed = true;
    else if (oidc?.oem?.status === "active" && oidc.oem.orgId === fw.orgId) allowed = true;
  }
  if (!fw || !allowed || !fw.image) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const upstream = await getAttachment(DB.files, fw._id, IMAGE_ATTACHMENT);
  if (!upstream.ok || !upstream.body) return NextResponse.json({ error: "Could not read photo" }, { status: 502 });

  return new Response(upstream.body, {
    headers: {
      // The type was sniffed from the bytes at upload; never echo anything the client sent.
      "Content-Type": fw.image.contentType,
      "Content-Length": String(fw.image.size),
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      // The URL carries a hash of the photo, so a changed photo gets a new URL.
      "Cache-Control": "private, max-age=86400",
    },
  });
}
