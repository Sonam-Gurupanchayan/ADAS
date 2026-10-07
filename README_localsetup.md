# Run Locally

This guide starts Firmware Hub on your machine with CouchDB and Mailpit running in Docker.

## Prerequisites

- Docker Desktop with Docker Compose
- Node.js and npm

## Setup

### 1. Configure the environment

Create `.env.local` from the example if you do not already have a local environment file:

```sh
cp .env.example .env.local
```

Check the CouchDB settings in `.env.local`. The defaults match `docker-compose.yml`:

```dotenv
COUCHDB_URL=http://localhost:5984
COUCHDB_USER=fw_app
COUCHDB_PASSWORD=change-me
COUCHDB_DB=adas_dist
APP_ORIGIN=http://localhost:3010
SMTP_URL=smtp://localhost:1025
```

Replace the placeholder values for the session secrets with fresh values. Generate each value in a terminal, then paste its output into `.env.local`:

```sh
openssl rand -base64 32
openssl rand -base64 48
```

Keep `.env.local` private and out of source control. Do not reuse these local secrets in production.

### 2. Start CouchDB and Mailpit

```sh
docker compose up -d
```

Check that both services are running:

```sh
docker compose ps
```

### 3. Create the CouchDB database

Open Fauxton at [http://localhost:5984/_utils](http://localhost:5984/_utils) and sign in with the CouchDB credentials from `.env.local`. Create the database named by `COUCHDB_DB` (default: `adas_dist`) if it does not already exist.

`npm run couch:init` does not create the database. The account used for initialization must be an administrator of the database. If the app account is not an admin, set `COUCHDB_ADMIN_USER` and `COUCHDB_ADMIN_PASSWORD` in `.env.local`.

### 4. Install dependencies and initialize CouchDB

```sh
npm install
npm run couch:init
```

The initialization command creates the required indexes and installs the audit-log validation design document. It is safe to run again.

### 5. Start the app

```sh
npm run dev
```

Open [http://localhost:3010](http://localhost:3010).

## Sign-in

Supplier and admin sign-in requires a real OpenID Connect provider. Configure `OIDC_ISSUER`, `OIDC_CLIENT_ID`, and `OIDC_CLIENT_SECRET` in `.env.local`, then register this callback URL with the provider:

```text
http://localhost:3010/api/auth/callback/oidc
```

The example OIDC settings in `.env.example` are placeholders and will not authenticate. Sensor users sign in with passkeys after an admin invites them.

## Local services

| Service | URL |
| --- | --- |
| Firmware Hub | [http://localhost:3010](http://localhost:3010) |
| CouchDB Fauxton | [http://localhost:5984/_utils](http://localhost:5984/_utils) |
| Mailpit inbox | [http://localhost:8025](http://localhost:8025) |

Mailpit receives invitation emails sent by the app. Its SMTP endpoint is `localhost:1025`.

## Common commands

```sh
npm run typecheck
npm test
npm run lint
```