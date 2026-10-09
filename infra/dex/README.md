# Local OIDC provider (Dex)

The local provider of the dev stack: one small container, static clients and users, no admin
console. [infra/keycloak](../keycloak/README.md) stays available to test what is specific to
Keycloak (realm settings, `offline_access` role, logout).

The dev stack of `infra/database` runs it under the `dex` profile:

```bash
cd infra/database
docker compose --profile dex up -d --no-recreate dex
```

## Sign in with the people of your local database

From the main checkout:

```bash
node infra/dex/sync-users.mjs
```

It asks once for a local dev password, then:

- gives every person of your local database (`DATABASE_NAME` in `apps/api/.env`) a Dex account
  with their email and that password;
- lists the origins of `FRONTEND_URL` as redirect URIs, read like the API's CORS
  (`https://connect.localhost:5173` and `:5174` when it is empty), plus the Bull Board callback
  when `BULL_BOARD_BASE_URL` is set;
- writes `infra/dex/config.local.yaml`, which is git-ignored because it holds emails;
- points `apps/api/.env` and `apps/web/.env.local` at Dex, after a one-time backup next to each
  file (`*.dontsave-before-dex`);
- recreates the `dex` container.

Restart `npm run dev` and sign in with your email and the dev password. Every account keeps its
data: nothing is written to the database, and at the first sign-in the API links each account to
its Dex identity by verified email ([ADR 0021](../../docs/adr/0021-generic-oidc-and-access-by-email.md)).

Run it again when people are added to the database, or after changing `FRONTEND_URL`,
`VITE_BASE_PATH`, `BULL_BOARD_BASE_URL` or `BULL_BOARD_ROUTE`. `--dry-run` shows what it would do,
`--password` changes the password. The password is kept hashed in
`~/.bayes-worktrees/dex-password.bcrypt`, which the worktree environments reuse.

On the dev VM, forward port 5556 to your laptop: the issuer is `http://localhost:5556/dex` for the
browser and the API alike.

## What the configuration contains

Without `config.local.yaml`, Dex reads [config.sample.yaml](config.sample.yaml):

- `platform-web`: public client of the web app (authorization code + PKCE).
- `bull-board`: confidential client of the Bull Board dashboard
  (`BULL_BOARD_OIDC_CLIENT_ID=bull-board`, `BULL_BOARD_OIDC_CLIENT_SECRET=local-bull-board-secret`).
- Two users: `admin@example.org` / `admin` and `member@example.org` / `member`.
  Dex reports their emails as verified.

A fresh database has nobody for `sync-users.mjs` yet: sign in with `admin@example.org` / `admin`,
then give it a platform role (below). You can also grant your own email a platform role first: the
command creates your account, and `sync-users.mjs` then gives it a Dex account.

The generated `config.local.yaml` has the same two clients, with the redirect URIs of your `.env`
files, and the people of your database in place of the two users.

## Manual configuration

`sync-users.mjs` sets these values. To do it by hand, set in `apps/api/.env`:

```
OIDC_ISSUER_URL=http://localhost:5556/dex
WEB_OIDC_CLIENT_ID=platform-web
```

and in `apps/web/.env.local`:

```
VITE_OIDC_AUTHORITY=http://localhost:5556/dex
VITE_OIDC_CLIENT_ID=platform-web
```

Leave `OIDC_AUDIENCE` and `OIDC_AUTHORIZATION_PARAMS` empty: the Auth0 values make the API refuse
Dex tokens. A password hash comes from `htpasswd -bnBC 10 "" <password> | tr -d ':\n'`. The
repository is public: personal emails stay out of it, in `config.local.yaml` only.

Give the first administrator a platform role:

```bash
npm run platform-role -w apps/api -- grant --email admin@example.org --role platform_superadmin
```

## Differences from Keycloak

- **Exact redirect URIs.** Dex accepts no wildcards. Every origin the web app runs on must be in
  `FRONTEND_URL`, then run `sync-users.mjs` again. That includes `http://localhost:5173` without
  HTTPS, where CORS needs it too, and the API's own origin when `WEB_APP_DIST_DIR` serves the build.
- **No provider logout.** Dex has no `end_session_endpoint`, so the web app logs out locally only.
  Dex keeps no session either: the next sign-in asks for the password again.
- **Keys in memory.** A restart creates new signing keys and invalidates the tokens in the
  browser. Sign in again.
- **Token for scripts.** The password grant is on, to call the API without a browser:

```bash
curl -s http://localhost:5556/dex/token -d grant_type=password -d client_id=platform-web -d username=<your email> -d password=<dev password> -d scope="openid profile email offline_access"
```
