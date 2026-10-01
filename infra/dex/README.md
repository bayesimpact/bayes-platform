# Local OIDC provider (Dex)

A lighter alternative to [infra/keycloak](../keycloak/README.md): one small
container, static clients and users, no admin console. Use Keycloak to test
what is specific to it (realm settings, `offline_access` role, logout).

```bash
docker compose -f infra/dex/docker-compose.yaml up -d
```

Then set, in `apps/api/.env`:

```
OIDC_ISSUER_URL=http://localhost:5556/dex
WEB_OIDC_CLIENT_ID=platform-web
```

and in `apps/web/.env.local`:

```
VITE_OIDC_AUTHORITY=http://localhost:5556/dex
VITE_OIDC_CLIENT_ID=platform-web
```

Leave `OIDC_AUDIENCE` and `OIDC_AUTHORIZATION_PARAMS` empty: the Auth0
values make the API refuse Dex tokens.

## What the configuration contains

Same as the Keycloak realm, in [config.sample.yaml](config.sample.yaml):

- `platform-web`: public client of the web app (authorization code + PKCE).
- `bull-board`: confidential client of the Bull Board dashboard
  (`BULL_BOARD_OIDC_CLIENT_ID=bull-board`, `BULL_BOARD_OIDC_CLIENT_SECRET=local-bull-board-secret`).
- Two users: `admin@example.org` / `admin` and `member@example.org` / `member`.
  Dex reports their emails as verified.

## Your own users

The repository is public: personal emails stay out of it. Copy the sample to
`config.local.yaml` (git-ignored) and edit the copy. Dex reads it instead of
the sample at the next start.

```bash
cp infra/dex/config.sample.yaml infra/dex/config.local.yaml
```

A password hash comes from `htpasswd -bnBC 10 "" <password> | tr -d ':\n'`.
The copy does not follow later changes of the sample (new client, new
redirect URI): copy it again when the sample changes.

Give the first administrator a platform role:

```bash
npm run platform-role -w apps/api -- grant --email admin@example.org --role platform_superadmin
```

## Differences from Keycloak

- **Exact redirect URIs.** Dex accepts no wildcards. A web app served from
  another origin or base path must be added to `redirectURIs`.
- **No provider logout.** Dex has no `end_session_endpoint`, so the web app
  logs out locally only. Dex keeps no session either: the next sign-in asks
  for the password again.
- **Keys in memory.** A restart creates new signing keys and invalidates the
  tokens in the browser. Sign in again.
- **Token for scripts.** The password grant is on, to call the API without a
  browser:

```bash
curl -s http://localhost:5556/dex/token -d grant_type=password -d client_id=platform-web -d username=admin@example.org -d password=admin -d scope="openid profile email offline_access"
```
