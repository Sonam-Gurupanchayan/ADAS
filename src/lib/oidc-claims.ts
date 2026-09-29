/** Resolve a dotted claim path, e.g. "realm_access.roles" or "groups". */
export function readClaim(profile: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, profile);
}

export function claimIncludes(value: unknown, expected: string) {
  if (Array.isArray(value)) return value.map(String).includes(expected);
  if (typeof value === "string") return value === expected || value.split(/[\s,]+/).includes(expected);
  if (typeof value === "boolean") return String(value) === expected;
  return false;
}

/** OIDC_ADMIN_VALUE may list several accepted values, separated by commas. */
export function parseExpected(expected: string) {
  return expected
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function isAdminProfile(
  profile: Record<string, unknown>,
  claim = process.env.OIDC_ADMIN_CLAIM || "groups",
  expected = process.env.OIDC_ADMIN_VALUE || "firmware-admins",
) {
  const accepted = parseExpected(expected);
  if (claim === "email") {
    // An email only proves identity once the provider has verified it (Google sends email_verified: true).
    const verified = profile.email_verified;
    if (verified !== true && verified !== "true") return false;
    const email = typeof profile.email === "string" ? profile.email.trim().toLowerCase() : "";
    return !!email && accepted.some((a) => a.toLowerCase() === email);
  }
  const value = readClaim(profile, claim);
  return accepted.some((a) => claimIncludes(value, a));
}
