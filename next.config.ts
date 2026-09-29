import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

function issuerOrigin() {
  try {
    return process.env.OIDC_ISSUER ? new URL(process.env.OIDC_ISSUER).origin : "";
  } catch {
    return "";
  }
}

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  `form-action 'self' ${issuerOrigin()}`.trim(),
  "object-src 'none'",
].join("; ");

// Turbopack's on-disk cache needs fsync, which network shares (SMB) don't support.
// It is only a speed-up; set TURBOPACK_FS_CACHE=1 when the project is on a local disk.
const fsCache = process.env.TURBOPACK_FS_CACHE === "1";

function appHostname() {
  try {
    return process.env.APP_ORIGIN ? new URL(process.env.APP_ORIGIN).hostname : "";
  } catch {
    return "";
  }
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Lets the dev server be used from APP_ORIGIN's host (e.g. when it runs on another machine).
  allowedDevOrigins: appHostname() ? [appHostname()] : [],
  experimental: {
    turbopackFileSystemCacheForDev: fsCache,
    turbopackFileSystemCacheForBuild: fsCache,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          // Enrolment links carry a token in the URL — never leak it via Referer.
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), publickey-credentials-get=(self), publickey-credentials-create=(self)" },
          ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
