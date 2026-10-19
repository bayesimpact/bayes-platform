# Local OIDC provider (oidc-picker)

The local provider of the dev stack: [oidc-picker](https://github.com/bayesimpact/oidc-picker), a
small OpenID Connect provider built on node-oidc-provider. Its sign-in page lists people: click
one and you are signed in as that person, without a password. It is for local development only.
[infra/keycloak](../keycloak/README.md) stays available to test what is specific to Keycloak
(realm settings, `offline_access` role, logout).

The dev stack of `infra/database` runs it under the `oidc-picker` profile, on
`http://localhost:5556`:

```bash
cd infra/database
docker compose --profile oidc-picker up -d --no-recreate oidc-picker
```

Then point the API and the web app at it. In `apps/api/.env`:

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
the picker's tokens.

## Who it lists

Without `config.local.yaml`, the picker reads [config.sample.yaml](config.sample.yaml):

- `platform-web`: public client of the web app (authorization code + PKCE).
- Two people: `admin@example.org` and `member@example.org`. The picker reports every email as
  verified.

On a fresh database, sign in as `admin@example.org`, then give it a platform role:

```bash
npm run platform-role -w apps/api -- grant --email admin@example.org --role platform_superadmin
```

To sign in as the people of your database, write `config.local.yaml` next to the sample, with the
same client and the redirect URIs of your `.env` files, and list them in it (or in a
`profiles.yaml` it names as `profilesFile`, which the picker reads again when it changes). Both
files are git-ignored: the repository is public, and personal emails stay out of it. The team's
worktree tooling writes them from the database. Each account keeps its data: at the first
sign-in, the API links it to its new identity by verified email
([ADR 0021](../../docs/adr/0021-generic-oidc-and-access-by-email.md)).

## Worktree environments

Each worktree environment runs its own picker, `auth` in
[infra/worktree/docker-compose.yaml](../worktree/docker-compose.yaml), on `<name>-auth.<domain>`,
from the configuration the worktree tooling writes in `WT_AUTH_DIR`, where the picker also keeps
its signing keys: a restart keeps people signed in.

## Notes

- **Signing keys.** The main checkout's picker keeps them in memory: a restart signs you out.
- **Logout.** The picker has an `end_session_endpoint` and logs out without a confirmation page.
- **Token for scripts.** The password grant is on: the username picks the profile and the
  password is ignored.

```bash
curl -s http://localhost:5556/token -d grant_type=password -d client_id=platform-web -d username=<your email> -d password=x -d scope="openid profile email offline_access"
```
