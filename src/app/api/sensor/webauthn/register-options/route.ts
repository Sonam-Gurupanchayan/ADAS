import { NextResponse } from "next/server";
import { logEvent, ANON } from "@/lib/audit";
import { checkEnrolToken, getSensorUser, listPasskeys } from "@/lib/repo/directory";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getSensorSession, setChallenge } from "@/lib/sensor-session";
import { registrationOptions } from "@/lib/webauthn";

// Start passkey registration: either first-time enrolment (with an invite token)
// or adding another passkey while signed in.
export async function POST(req: Request) {
  if (!rateLimit(`reg:${clientIp(req)}`, 10, 10)) {
    return NextResponse.json({ error: "Too many attempts. Try again in a minute." }, { status: 429 });
  }
  const body = (await req.json().catch(() => ({}))) as { token?: string };

  if (body.token) {
    const token = await checkEnrolToken(body.token);
    if (!token) {
      await logEvent(ANON, "passkey.register_options", { result: "denied", meta: { reason: "invalid_token" } });
      return NextResponse.json({ error: "This enrolment link is invalid or has expired." }, { status: 400 });
    }
    const user = await getSensorUser(token.userId);
    if (!user || user.status === "disabled") {
      return NextResponse.json({ error: "This account is disabled." }, { status: 403 });
    }
    const options = await registrationOptions(user, await listPasskeys(user._id));
    await setChallenge("register", options.challenge, { enrolTokenId: token._id, enrolUserId: user._id });
    return NextResponse.json(options);
  }

  const session = await getSensorSession();
  const user = session.userId ? await getSensorUser(session.userId) : null;
  if (!user || user.status !== "active") {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  const options = await registrationOptions(user, await listPasskeys(user._id));
  await setChallenge("register", options.challenge, { enrolUserId: user._id });
  return NextResponse.json(options);
}
