# Upgrading from Auth0 to generic OpenID Connect

From #148 on, the platform signs users in with any OpenID Connect provider and no longer talks to the Auth0 Management API. Auth0 keeps working as a plain OIDC provider: an install can move with the same tenant, organizations and applications, and switch to another provider later. The reasons are in [ADR 0021](../adr/0021-generic-oidc-and-access-by-email.md).

This page covers what to change in a `.env` file or in Helm values, and in which order.

## Variables

### API (`apps/api/.env`, Helm `config`)

| Before | After |
|---|---|
| `AUTH0_ISSUER_URL` | `OIDC_ISSUER_URL`, same value |
| `AUTH0_AUDIENCE` | `OIDC_AUDIENCE`, same value |
| `AUTH0_ORGANIZATION_ID=org_xxx` | `OIDC_AUTHORIZATION_PARAMS={"organization":"org_xxx"}` |
| `AUTH0_CLIENT_ID` | removed (the web client id is `WEB_OIDC_CLIENT_ID`) |
| `AUTH0_M2M_CLIENT_ID`, `AUTH0_M2M_CLIENT_SECRET`, `AUTH0_DB_CONNECTION_NAME` | removed, nothing reads them |
| `BULL_BOARD_AUTH0_CLIENT_ID`, `BULL_BOARD_AUTH0_CLIENT_SECRET` | `BULL_BOARD_OIDC_CLIENT_ID`, `BULL_BOARD_OIDC_CLIENT_SECRET` |
| `BULL_BOARD_AUTH0_ORGANIZATION` | removed, covered by `OIDC_AUTHORIZATION_PARAMS` |

New, optional:

| Variable | Default | Meaning |
|---|---|---|
| `OIDC_ALLOW_EMAIL_LINKING` | `true` | Links a first sign-in to the account of someone added by email |
| `OIDC_TRUST_UNVERIFIED_EMAIL` | `false` | Links even when the provider does not report the email as verified. Only for a single-tenant provider the customer fully controls |

### Web front served by the API (`WEB_*`, Helm `web.env`)

| Before | After |
|---|---|
| `WEB_AUTH0_CLIENT_ID` | `WEB_OIDC_CLIENT_ID` (required) |
| `WEB_AUTH0_DOMAIN` | `WEB_OIDC_AUTHORITY`, a full URL. Only to override `OIDC_ISSUER_URL` |
| `WEB_AUTH0_AUDIENCE` | `WEB_OIDC_AUDIENCE`. Only to override `OIDC_AUDIENCE` |
| `WEB_AUTH0_ORGANIZATION_ID` | `WEB_OIDC_AUTHORIZATION_PARAMS`. Only to override `OIDC_AUTHORIZATION_PARAMS` |

`WEB_OIDC_SCOPE` is optional and defaults to `openid profile email offline_access`.

### Web front in development (`apps/web/.env.local`)

| Before | After |
|---|---|
| `VITE_AUTH0_DOMAIN=tenant.auth0.com` | `VITE_OIDC_AUTHORITY=https://tenant.auth0.com/` |
| `VITE_AUTH0_CLIENT_ID` | `VITE_OIDC_CLIENT_ID` |
| `VITE_AUTH0_AUDIENCE` | `VITE_OIDC_AUDIENCE` |
| `VITE_AUTH0_ORGANIZATION_ID=org_xxx` | `VITE_OIDC_AUTHORIZATION_PARAMS={"organization":"org_xxx"}` |

`VITE_OIDC_SCOPE` is optional, with the same default as `WEB_OIDC_SCOPE`.

### Example: staying on Auth0

```
OIDC_ISSUER_URL=https://my-tenant.eu.auth0.com/
OIDC_AUDIENCE=https://my-tenant.eu.auth0.com/api/v2/
OIDC_AUTHORIZATION_PARAMS={"organization":"org_xxx"}
WEB_OIDC_CLIENT_ID=<the SPA application client id>
```

## Pitfalls

- **Trailing slash.** `OIDC_ISSUER_URL` must equal the `iss` claim of the access tokens. Auth0 issuers end with `/`, Keycloak issuers do not.
- **JSON values.** `OIDC_AUTHORIZATION_PARAMS` is a JSON object whose values are strings. A malformed value stops the API at start, on purpose.
- **Organization.** The web app no longer sends the Auth0 `organization` parameter by itself. An Auth0 application set to "Business users" only needs `OIDC_AUTHORIZATION_PARAMS`, or the login fails.
- **Verified emails.** People added by email, or invited but never signed in, are linked at their first sign-in only if the provider returns `email_verified: true`. Accounts the old code created through the Management API were unverified: their first sign-in is refused with an explicit message until the email is verified in the provider. Accounts that already signed in are found by their `sub` and are not affected.
- **Refresh tokens.** The web app asks for `offline_access`. A provider that does not allow it for the user fails the token exchange (Keycloak: "Offline tokens not allowed"). Allow it, or set `WEB_OIDC_SCOPE=openid profile email`.
- **Logout.** The web app uses the provider's `end_session_endpoint`. On Auth0, enable "RP-Initiated Logout End Session Endpoint Discovery" on the tenant and keep the app URL in the "Allowed Logout URLs", or the user is signed back in right away.

## Database

The migration `GenericOidcUserSubject` runs with the others (the Helm `pre-upgrade` job, or `npm run migration:run -w apps/api`). It:

- renames `user.auth0_id` to `user.auth_subject`, NULL for people who never signed in;
- turns pending invitations into the memberships their acceptance would have created, and marks them accepted. Nothing to run by hand.

Code from before #148 cannot read the renamed column. To go back to an older branch on the same database, revert first:

```bash
npm run migration:revert -w apps/api
```

The revert restores the column. Memberships created from invitations stay.

## Order of a deployment

1. Add the new variables next to the `AUTH0_*` ones. Images from before #148 ignore them, so this changes nothing yet.
2. Deploy the new image. The migration runs before the new pods start.
3. Check: sign in with an existing account, add a member by email, sign in as that member, log out.
4. Once every environment runs the new image, remove the `AUTH0_*` variables and the `AUTH0_M2M_CLIENT_SECRET` secret.

During the transition, a developer who switches between old and new branches keeps both sets of variables in the same `.env`.

## Moving to another provider

Point `OIDC_ISSUER_URL`, `OIDC_AUDIENCE` and `WEB_OIDC_CLIENT_ID` at the new provider. The `sub` of every user changes, so each existing account is linked again at its next sign-in through its verified email. Give the new provider the same emails, marked verified.

For local development, `infra/keycloak` runs a ready Keycloak realm. See [its README](../../infra/keycloak/README.md).
