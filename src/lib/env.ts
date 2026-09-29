import "server-only";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}`);
  return v;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

// Read lazily so `next build` does not need production secrets.
export const env = {
  get couchUrl() {
    return required("COUCHDB_URL").replace(/\/+$/, "");
  },
  get couchUser() {
    return required("COUCHDB_USER");
  },
  get couchPassword() {
    return required("COUCHDB_PASSWORD");
  },
  get couchDb() {
    return optional("COUCHDB_DB", "adas_dist");
  },
  get sensorSessionSecret() {
    const s = required("SENSOR_SESSION_SECRET");
    if (s.length < 32) throw new Error("SENSOR_SESSION_SECRET must be at least 32 characters");
    return s;
  },
  get appOrigin() {
    return required("APP_ORIGIN").replace(/\/+$/, "");
  },
  get rpId() {
    return optional("WEBAUTHN_RP_ID", new URL(this.appOrigin).hostname);
  },
  get rpName() {
    return optional("WEBAUTHN_RP_NAME", "Firmware Hub");
  },
  get maxUploadBytes() {
    return Number(optional("MAX_UPLOAD_MB", "500")) * 1024 * 1024;
  },
  get smtpUrl() {
    return process.env.SMTP_URL || null;
  },
  get mailFrom() {
    return optional("MAIL_FROM", "Firmware Hub <no-reply@localhost>");
  },
  get oidcAdminClaim() {
    return optional("OIDC_ADMIN_CLAIM", "groups");
  },
  get oidcAdminValue() {
    return optional("OIDC_ADMIN_VALUE", "firmware-admins");
  },
  get isProd() {
    return process.env.NODE_ENV === "production";
  },
};
