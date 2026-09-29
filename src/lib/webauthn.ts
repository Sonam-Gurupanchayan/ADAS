import "server-only";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransport,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { env } from "./env";
import type { Passkey, SensorUser } from "./types";

// Passkeys are the only sign-in method for sensor users. Requiring user verification
// means every sign-in proves possession of the authenticator (factor 1) *and*
// a biometric or PIN on that authenticator (factor 2).

export async function registrationOptions(user: SensorUser, existing: Passkey[]) {
  return generateRegistrationOptions({
    rpName: env.rpName,
    rpID: env.rpId,
    userName: user.email,
    userDisplayName: user.name,
    userID: new TextEncoder().encode(user._id),
    attestationType: "none",
    excludeCredentials: existing.map((p) => ({
      id: p.credentialId,
      transports: p.transports as AuthenticatorTransport[],
    })),
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
    timeout: 5 * 60_000,
  });
}

export async function verifyRegistration(response: RegistrationResponseJSON, expectedChallenge: string) {
  const result = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: env.appOrigin,
    expectedRPID: env.rpId,
    requireUserVerification: true,
  });
  if (!result.verified || !result.registrationInfo) return null;
  const { credential, credentialDeviceType, credentialBackedUp } = result.registrationInfo;
  return {
    credentialId: credential.id,
    publicKey: isoBase64URL.fromBuffer(credential.publicKey),
    counter: credential.counter,
    transports: (credential.transports ?? response.response.transports ?? []) as string[],
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
  };
}

export async function authenticationOptions() {
  // Usernameless: empty allowCredentials lets the browser offer any discoverable passkey for this site.
  return generateAuthenticationOptions({
    rpID: env.rpId,
    userVerification: "required",
    allowCredentials: [],
    timeout: 5 * 60_000,
  });
}

export async function verifyAuthentication(
  response: AuthenticationResponseJSON,
  expectedChallenge: string,
  passkey: Passkey,
) {
  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: env.appOrigin,
    expectedRPID: env.rpId,
    requireUserVerification: true,
    credential: {
      id: passkey.credentialId,
      publicKey: isoBase64URL.toBuffer(passkey.publicKey),
      counter: passkey.counter,
      transports: passkey.transports as AuthenticatorTransport[],
    },
  });
  if (!result.verified) return null;
  return { newCounter: result.authenticationInfo.newCounter };
}

export function describeDevice(userAgent: string | null) {
  const ua = userAgent ?? "";
  const os = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "Device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return browser ? `${browser} on ${os}` : os;
}
