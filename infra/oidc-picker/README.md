# Local OIDC provider (oidc-picker)

The local provider of the dev stack: [oidc-picker](https://github.com/bayesimpact/oidc-picker), a
small OpenID Connect provider built on node-oidc-provider. Its sign-in page lists people: click
one and you are signed in as that person, without a password. It is for local development only.
[infra/keycloak](../keycloak/README.md) stays available to test what is specific to Keycloak
(realm settings, `offline_access` role, logout).

The dev stack of `infra/database` runs it under the `oidc-picker` profile:

```bash
cd infra/database
docker compose --profile oidc-picker up -d --no-recreate oidc-picker
```

## Sign in as the people of your local database

From the main checkout:

```bash
node infra/oidc-picker/sync-users.mjs
```

It:

- lists every person of your local database (`DATABASE_NAME` in `apps/api/.env`) in
  `infra/oidc-picker/profiles.yaml`, with their platform id as `sub` and their stored name;
- lists the origins of `FRONTEND_URL` as redirect URIs, read like the API's CORS
  (`https://connect.localhost:5173` and `:5174` when it is empty);
- writes `infra/oidc-picker/config.local.yaml`. Both files are git-ignored because they hold
  emails;
- points `apps/api/.env` and `apps/web/.env.local` at the picker, after a one-time backup next to
  each file (`*.dontsave-before-oidc-picker`);
- starts the `oidc-picker` container, recreated when its configuration changed.

Restart `npm run dev` and sign in by clicking your name. Every account keeps its data: nothing is
written to the database, and at the first sign-in the API links each account to its new identity
by verified email ([ADR 0021](../../docs/adr/0021-generic-oidc-and-access-by-email.md)).

Run it again when people are added to the database: the picker reads the new profiles without a
restart. Run it after changing `FRONTEND_URL` or `VITE_BASE_PATH` too. `--dry-run` shows what it
would do.

On the dev VM, forward port 5556 to your laptop: the issuer is `http://localhost:5556` for the
browser and the API alike.

## What the configuration contains

Without `config.local.yaml`, the picker reads [config.sample.yaml](config.sample.yaml):

- `platform-web`: public client of the web app (authorization code + PKCE).
- Two people: `admin@example.org` and `member@example.org`. The picker reports every email as
  verified.

A fresh database has nobody for `sync-users.mjs` yet: sign in as `admin@example.org`, then give it
a platform role (below). You can also grant your own email a platform role first: the command
creates your account, and `sync-users.mjs` then lists it.

## Manual configuration

`sync-users.mjs` sets these values. To do it by hand, set in `apps/api/.env`:

```
OIDC_ISSUER_URL=http://localhost:5556
WEB_OIDC_CLIENT_ID=platform-web
```

and in `apps/web/.env.local`:

```
VITE_OIDC_AUTHORITY=http://localhost:5556
VITE_OIDC_CLIENT_ID=platform-web
```

Leave `OIDC_AUDIENCE` and `OIDC_AUTHORIZATION_PARAMS` empty: the Auth0 values make the API refuse
the picker's tokens. The repository is public: personal emails stay out of it, in the git-ignored
files only.

Give the first administrator a platform role:

```bash
npm run platform-role -w apps/api -- grant --email admin@example.org --role platform_superadmin
```

## Worktree environments

Each worktree environment runs its own picker, `auth` in
[infra/worktree/docker-compose.yaml](../worktree/docker-compose.yaml), on
`<name>-auth.<domain>`. The worktree tooling writes its configuration with
[picker-config.mjs](picker-config.mjs): the people of the environment's database and its own
redirect URIs. It keeps its signing keys in the environment's folder, so a restart keeps people
signed in.

## Notes

- **Signing keys.** The main checkout's picker keeps them in memory: a restart signs you out.
- **Logout.** The picker has an `end_session_endpoint` and logs out without a confirmation page.
- **Token for scripts.** The password grant is on: the username picks the profile and the
  password is ignored.

```bash
curl -s http://localhost:5556/token -d grant_type=password -d client_id=platform-web -d username=<your email> -d password=x -d scope="openid profile email offline_access"
```
