import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { setChallenge } from "@/lib/sensor-session";
import { authenticationOptions } from "@/lib/webauthn";

export async function POST(req: Request) {
  if (!rateLimit(`login:${clientIp(req)}`, 20, 20)) {
    return NextResponse.json({ error: "Too many attempts. Try again in a minute." }, { status: 429 });
  }
  const options = await authenticationOptions();
  await setChallenge("login", options.challenge);
  return NextResponse.json(options);
}
