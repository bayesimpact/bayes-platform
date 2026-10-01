# Local OIDC provider (Keycloak)

The platform authenticates users with any OpenID Connect provider. For local
development, this folder runs Keycloak with a `platform` realm already set up.

```bash
docker compose -f infra/keycloak/docker-compose.yaml up -d
```

Then set, in `apps/api/.env`:

```
OIDC_ISSUER_URL=http://localhost:8080/realms/platform
WEB_OIDC_CLIENT_ID=platform-web
```

and in `apps/web/.env.local`:

```
VITE_OIDC_AUTHORITY=http://localhost:8080/realms/platform
VITE_OIDC_CLIENT_ID=platform-web
```

## What the realm contains

In [realm-platform.sample.json](realm-platform.sample.json):

- `platform-web`: public client of the web app (authorization code + PKCE).
- `bull-board`: confidential client of the Bull Board dashboard
  (`BULL_BOARD_OIDC_CLIENT_ID=bull-board`, `BULL_BOARD_OIDC_CLIENT_SECRET=local-bull-board-secret`).
- Two users with verified emails: `admin@example.org` / `admin` and
  `member@example.org` / `member`.

The first sign-in creates the platform account without any access. Give the
first administrator a platform role, then add people from the members screens:

```bash
npm run platform-role -w apps/api -- grant --email admin@example.org --role platform_superadmin
```

The admin console is at http://localhost:8080 (`admin` / `admin`). Accounts
created there must have **Email verified** checked, or the platform refuses to
link them to the access they were given by email.

## Your own users

The repository is public: personal emails stay out of it. Copy the sample to
`realm-platform.local.json` (git-ignored) and edit the copy. Keycloak imports
it instead of the sample when the container is created.

```bash
cp infra/keycloak/realm-platform.sample.json infra/keycloak/realm-platform.local.json
```

The realm is imported once: recreate the container to apply a change
(`docker compose -f infra/keycloak/docker-compose.yaml up -d --force-recreate`).
Copy the sample again when it changes.

## Troubleshooting

The web app asks for the `offline_access` scope to get a refresh token. A user
without the `offline_access` role (part of `default-roles-platform`) fails at
the token exchange with "Offline tokens not allowed for the user or client".
Keycloak sends that error without CORS headers, so the browser only reports a
CORS error and the app shows "Failed to fetch". Check the Keycloak logs, and
either give the user the default roles or set `VITE_OIDC_SCOPE` /
`WEB_OIDC_SCOPE` to `openid profile email`.
