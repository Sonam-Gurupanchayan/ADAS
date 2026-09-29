import "server-only";
import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";
import { env } from "./env";

export type SensorSessionData = {
  userId?: string;
  loginAt?: number;
  // Pending WebAuthn ceremony. Challenges are single-use and expire after 5 minutes.
  challenge?: string;
  challengeExp?: number;
  challengeKind?: "register" | "login";
  enrolTokenId?: string;
  enrolUserId?: string;
};

export const SENSOR_COOKIE = "sensor_session";
const TTL_SECONDS = 12 * 60 * 60;

function options(): SessionOptions {
  return {
    cookieName: SENSOR_COOKIE,
    password: env.sensorSessionSecret,
    ttl: TTL_SECONDS,
    cookieOptions: {
      httpOnly: true,
      secure: env.isProd,
      sameSite: "lax",
      path: "/",
    },
  };
}

export async function getSensorSession() {
  return getIronSession<SensorSessionData>(await cookies(), options());
}

export async function setChallenge(
  kind: "register" | "login",
  challenge: string,
  extra: Pick<SensorSessionData, "enrolTokenId" | "enrolUserId"> = {},
) {
  const s = await getSensorSession();
  s.challenge = challenge;
  s.challengeExp = Date.now() + 5 * 60_000;
  s.challengeKind = kind;
  s.enrolTokenId = extra.enrolTokenId;
  s.enrolUserId = extra.enrolUserId;
  await s.save();
}

/** Returns and clears the pending challenge (single use). */
export async function takeChallenge(kind: "register" | "login") {
  const s = await getSensorSession();
  const { challenge, challengeExp, challengeKind, enrolTokenId, enrolUserId } = s;
  s.challenge = undefined;
  s.challengeExp = undefined;
  s.challengeKind = undefined;
  s.enrolTokenId = undefined;
  s.enrolUserId = undefined;
  await s.save();
  if (!challenge || challengeKind !== kind || !challengeExp || challengeExp < Date.now()) return null;
  return { challenge, enrolTokenId, enrolUserId };
}
