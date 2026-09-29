import { NextResponse } from "next/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { ANON, logEvent } from "@/lib/audit";
import { getPasskey, getSensorUser, touchPasskey, updateSensorUser } from "@/lib/repo/directory";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getSensorSession, takeChallenge } from "@/lib/sensor-session";
import { verifyAuthentication } from "@/lib/webauthn";

const FAIL = "We couldn't sign you in with that passkey.";

export async function POST(req: Request) {
  if (!rateLimit(`login:${clientIp(req)}`, 20, 20)) {
    return NextResponse.json({ error: "Too many attempts. Try again in a minute." }, { status: 429 });
  }
  const body = (await req.json().catch(() => null)) as { response?: AuthenticationResponseJSON } | null;
  const pending = await takeChallenge("login");
  if (!body?.response?.id || !pending) {
    await logEvent(ANON, "auth.login_failed", { meta: { reason: "no_challenge" } , result: "denied"});
    return NextResponse.json({ error: "Sign-in expired. Please try again." }, { status: 400 });
  }

  const passkey = await getPasskey(body.response.id);
  if (!passkey) {
    await logEvent(ANON, "auth.login_failed", { result: "denied", meta: { reason: "unknown_credential" } });
    return NextResponse.json({ error: FAIL }, { status: 401 });
  }
  const user = await getSensorUser(passkey.userId);
  const actor = { type: "sensor" as const, id: passkey.userId, email: user?.email ?? null };
  if (!user || user.status !== "active") {
    await logEvent(actor, "auth.login_failed", { result: "denied", meta: { reason: `status_${user?.status ?? "missing"}` } });
    return NextResponse.json({ error: "Your account is not active. Contact your administrator." }, { status: 403 });
  }

  let result;
  try {
    result = await verifyAuthentication(body.response, pending.challenge, passkey);
  } catch (e) {
    await logEvent(actor, "auth.login_failed", { result: "error", meta: { reason: String((e as Error).message) } });
    return NextResponse.json({ error: FAIL }, { status: 401 });
  }
  if (!result) {
    await logEvent(actor, "auth.login_failed", { result: "denied", meta: { reason: "verification_failed" } });
    return NextResponse.json({ error: FAIL }, { status: 401 });
  }

  await touchPasskey(passkey.credentialId, result.newCounter);
  const session = await getSensorSession();
  session.userId = user._id;
  session.loginAt = Date.now();
  await session.save();
  await updateSensorUser(user._id, { lastLoginAt: new Date().toISOString() });
  await logEvent(actor, "auth.login", { targetId: passkey._id, meta: { method: "passkey" } });
  return NextResponse.json({ ok: true });
}
