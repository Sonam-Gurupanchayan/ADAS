import { NextResponse } from "next/server";
import { logEventSoft } from "@/lib/audit";
import { getSensorSession } from "@/lib/sensor-session";

export async function POST() {
  const session = await getSensorSession();
  if (session.userId) await logEventSoft({ type: "sensor", id: session.userId }, "auth.logout");
  session.destroy();
  return NextResponse.json({ ok: true });
}
