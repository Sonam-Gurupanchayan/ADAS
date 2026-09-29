# Firmware Hub

Secure distribution of sensor firmware from OEM suppliers to field technicians.

| Who | Where | Signs in with |
| --- | --- | --- |
| **Suppliers (OEMs)** upload firmware and its metadata | `/portal` | Your OpenID Connect provider |
| **Admins** approve releases, manage access, read the audit log | `/admin` | OIDC, with an admin claim |
| **Sensor users** browse and download entitled firmware (mobile-friendly PWA) | `/` | Passkey (FIDO2 with user verification = two factors) |

Firmware binaries (as attachments) and all metadata live in a single CouchDB database. Every sign-in, page view, download and admin change is written to an append-only audit log in that same database.

## How it works

- **Release workflow:** Draft → *Submit* → In review → *Approve* → Published. Admins can also *Request changes* (back to the supplier with a comment), *Withdraw* or *Republish*. Metadata can only be edited while a release is a draft or has changes requested.
- **Sensor photos:** suppliers can add a photo of the sensor to a release, and sensor users see it in the library and on the release page. Photos are resized in the browser, which also strips location data. They are stored as a second attachment (`image`) and must be JPEG, PNG or WebP, up to 5 MB, checked by file contents. Only people who can see the release can load its photo.
- **Access:** admins create **sensor models** (owned by a supplier organisation) and **access groups** (sets of models), then put sensor users in groups. A user sees a release only if it is published and targets at least one model from their groups. This is checked on every page and on every download request.
- **Sensor sign-in:** an admin invites a user by email. The single-use link (valid 72 h) lets them register a passkey (Face ID, Touch ID, Windows Hello, Android, or a security key). Each sign-in requires the device (possession) plus biometric or PIN (`userVerification: required`). Users can add more passkeys; admins can revoke passkeys or send a new link if a device is lost.
- **Uploads and downloads** stream straight to and from CouchDB, so files are never held in memory. The SHA-256 is computed during upload and shown to users so they can verify their download. Downloads support HTTP `Range`, so interrupted mobile downloads can resume. If the audit entry can't be written, the download is refused.

## Setup

### 1. CouchDB

Point the app at your existing CouchDB 3.x server and the database it should use (default `adas_dist`):

```bash
cp .env.example .env.local   # then fill it in
npm install
npm run couch:init
```

`couch:init` is idempotent. It **does not** create the database or change its `_security`. It:
- creates the Mango indexes (every one leads with `type`, since all document kinds share the database)
- installs `_design/fwhub-audit`, a `validate_doc_update` that rejects any edit or delete of an audit entry
- warns you if the database is readable by anyone, or if `[chttpd] max_http_request_size` / `[couchdb] max_attachment_size` are below `MAX_UPLOAD_MB`

The account it runs as must be an admin of the database. Use `COUCHDB_ADMIN_USER`/`COUCHDB_ADMIN_PASSWORD` if the app user isn't one.

### 2. OpenID Connect

Register a confidential client at your IdP:
- Redirect URI: `${APP_ORIGIN}/api/auth/callback/oidc`
- Scopes: `openid email profile` (plus whatever puts your admin group or role in the ID token)

Set `OIDC_ADMIN_CLAIM` / `OIDC_ADMIN_VALUE` to the claim that marks admins. For example, `groups` / `firmware-admins`, or `realm_access.roles` / `firmware-admin` for Keycloak. `OIDC_ADMIN_VALUE` can list several values separated by commas.

Google's tokens carry no groups, so with Google (`OIDC_ISSUER=https://accounts.google.com`) set `OIDC_ADMIN_CLAIM=email` and `OIDC_ADMIN_VALUE=alice@example.com,bob@example.com`. Emails match case-insensitively, and only when the provider marks them verified (`email_verified`).

On first sign-in, suppliers land on an "awaiting approval" page. An admin links them to an organisation and activates them under **Admin → Supplier accounts**.

### 3. Email

Invites are sent over `SMTP_URL`. For local development, `docker compose up -d` starts Mailpit (SMTP on 1025, inbox at http://localhost:8025). If `SMTP_URL` is unset, invite links are printed to the server log.

### 4. Run

```bash
npm run dev          # http://localhost:3010
npm run build && npm start
```

Passkeys need a secure context: `localhost` works over http, and anything else needs HTTPS. To test on a phone, expose the dev server through an HTTPS tunnel and set `APP_ORIGIN` to the tunnel URL. Passkeys are bound to `WEBAUTHN_RP_ID` (defaults to the `APP_ORIGIN` host), so don't change it once users have enrolled.

### First-run checklist

1. Sign in at `/portal/signin` with an account carrying the admin claim.
2. **Organisations:** add each supplier.
3. **Sensor models:** add models and assign each one to its manufacturer.
4. **Supplier accounts:** after suppliers sign in once, set their organisation and mark them Active.
5. **Access groups:** create groups and tick the models each can access.
6. **Sensor users:** invite users into groups.

## Data model (single database, `type` field)

| type | `_id` | notes |
| --- | --- | --- |
| `org` | `org:<slug>` | supplier organisation |
| `oem_user` | `oem:<oidc sub>` | created on first OIDC sign-in; `status` pending/active/disabled |
| `sensor_model` | `model:<slug>` | `manufacturerOrgId` |
| `group` | `group:<slug>` | `modelIds[]` |
| `sensor_user` | `su:<uuid>` | `groupIds[]`, `status` invited/active/disabled |
| `passkey` | `cred:<credential id>` | public key, signature counter, transports |
| `enrol_token` | `enrol:<sha256(token)>` | the raw token exists only in the email |
| `firmware` | `fw:<uuid>` | metadata + `binary` attachment + `file.{name,size,sha256}`; optional `image` attachment + `image.{contentType,size,sha256}` |
| `audit` | `audit:<ISO ts>:<uuid>` | append-only (enforced by `validate_doc_update`) |

## Security notes

- The supplier/admin session (Auth.js) and the sensor session (`sensor_session`, an encrypted iron-session cookie) are completely separate. Neither grants access to the other area.
- Authorization is enforced in every page, server action and route handler (`src/lib/guards.ts`). `src/proxy.ts` is only a coarse redirect, and it excludes `/api` because the proxy would buffer upload bodies.
- WebAuthn challenges are single-use and expire after 5 minutes. A signature counter that goes backwards is rejected.
- Downloads are always sent as `Content-Disposition: attachment` with `nosniff`. Supplier markdown is rendered without raw HTML.
- Rate limiting for login, registration and downloads is in-memory. If you run more than one instance, replace `src/lib/rate-limit.ts` with a shared store such as Redis.
- The service worker never caches API responses, downloads or pages, so every access is checked and logged.

## Development

```bash
npm run typecheck
npm test             # unit tests (access rules, workflow, validation, claims, audit)
npm run lint
```
