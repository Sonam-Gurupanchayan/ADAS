import { NextResponse } from "next/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { ANON, logEvent } from "@/lib/audit";
import { consumeEnrolToken, getSensorUser, savePasskey, updateSensorUser } from "@/lib/repo/directory";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getSensorSession, takeChallenge } from "@/lib/sensor-session";
import { describeDevice, verifyRegistration } from "@/lib/webauthn";

export async function POST(req: Request) {
  if (!rateLimit(`reg:${clientIp(req)}`, 10, 10)) {
    return NextResponse.json({ error: "Too many attempts. Try again in a minute." }, { status: 429 });
  }
  const body = (await req.json().catch(() => null)) as { response?: RegistrationResponseJSON } | null;
  const pending = await takeChallenge("register");
  if (!body?.response || !pending?.enrolUserId) {
    await logEvent(ANON, "passkey.registered", { result: "denied", meta: { reason: "no_challenge" } });
    return NextResponse.json({ error: "Registration expired. Please try again." }, { status: 400 });
  }

  const session = await getSensorSession();
  // Adding a passkey (no token) requires being signed in as that same user.
  if (!pending.enrolTokenId && session.userId !== pending.enrolUserId) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const user = await getSensorUser(pending.enrolUserId);
  if (!user || user.status === "disabled") {
    return NextResponse.json({ error: "This account is disabled." }, { status: 403 });
  }
  const actor = { type: "sensor" as const, id: user._id, email: user.email };

  let verified;
  try {
    verified = await verifyRegistration(body.response, pending.challenge);
  } catch (e) {
    await logEvent(actor, "passkey.registered", { result: "error", meta: { reason: String((e as Error).message) } });
    return NextResponse.json({ error: "We couldn't verify that passkey." }, { status: 400 });
  }
  if (!verified) {
    await logEvent(actor, "passkey.registered", { result: "denied" });
    return NextResponse.json({ error: "We couldn't verify that passkey." }, { status: 400 });
  }

  if (pending.enrolTokenId) {
    const consumed = await consumeEnrolToken(pending.enrolTokenId);
    if (!consumed) {
      await logEvent(actor, "passkey.registered", { result: "denied", meta: { reason: "token_used" } });
      return NextResponse.json({ error: "This enrolment link has already been used." }, { status: 400 });
    }
  }

  await savePasskey({
    userId: user._id,
    ...verified,
    deviceName: describeDevice(req.headers.get("user-agent")),
  });
  if (user.status === "invited") await updateSensorUser(user._id, { status: "active" });
  await logEvent(actor, "passkey.registered", {
    targetId: `cred:${verified.credentialId}`,
    meta: { deviceType: verified.deviceType, backedUp: verified.backedUp, viaInvite: !!pending.enrolTokenId },
  });

  if (session.userId !== user._id) {
    session.userId = user._id;
    session.loginAt = Date.now();
    await session.save();
    await updateSensorUser(user._id, { lastLoginAt: new Date().toISOString() });
    await logEvent(actor, "auth.login", { meta: { method: "passkey", viaInvite: true } });
  }
  return NextResponse.json({ ok: true });
}
