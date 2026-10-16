# ADR 0029: App installs on the OAuth authorization server

* **Status**: Accepted
* **Date**: 2026-10-16
* **Deciders**: Jérémie
* **Amends**: [ADR 0024](0024-conversation-apps.md) (install, who installs), [ADR 0028](0028-oauth-authorization-server.md) (confidential clients, app grants)
* **Scope**: `apps/api` (`domains/oauth`, `domains/apps`, `domains/rbac`), `apps/web` (consent page, back-office apps), API contracts.

---

## 1. Context

An app (a messaging channel, a crawler) installs on a workspace and acts
through a service user whose role holds the permissions granted at install
(ADR 0024). The install flow is custom: `apps/install/:slug/authorize`
returns a code, `apps/v1/install/exchange` turns it into a `client_id` and a
`client_secret` per installation, and `apps/v1/token` turns those into a
one-hour App JWT. Each app stores and rotates one secret per workspace and
carries its own OAuth code. Only platform staff can install (`app.install`).

The API now has a standard OAuth 2.1 authorization server for MCP clients
(ADR 0028), with a consent page, codes with PKCE, rotating refresh tokens
and revocation.

## 2. Decision

**Apps install and get their tokens through the authorization server of
ADR 0028. An app is one confidential OAuth client; each installation is a
grant with its refresh token. The service user model does not change.**

### 2.1 The app as a client

* Each app manifest gets one OAuth client (`registration_type` `app`) with a
  `client_id` and a `client_secret`. The secret is generated from the
  back-office, shown once, stored hashed (scrypt), and can be rotated.
* Redirect URIs are the manifest's `allowedRedirectUris` (exact `https`),
  plus loopback for local development, as today.
* The client authenticates at the token endpoint with `client_secret_basic`
  or `client_secret_post`. PKCE stays mandatory. The metadata announces both
  methods, so standard client libraries (`openid-client`, `omniauth-oauth2`)
  work without configuration.

### 2.2 Install through the consent page

* The app sends the person to `<web>/oauth/authorize` with its `client_id`,
  like an MCP client. The page shows the app as verified (it is registered by
  the platform), lets the person pick **one** workspace and the permissions
  among the manifest's `grantablePermissions`.
* The person can only grant a permission they hold on that workspace, so an
  install never gives an app more than its installer has.
* Approving creates what an install creates today (installation, service
  user, project role `app_install_<id>`, memberships), plus an OAuth grant
  linked to the installation, and returns the code. The installation records
  who installed it, but the grant belongs to no person, so the app keeps
  working when its installer's account goes. An app that is already
  installed on the workspace gets the same `409` as today.
* Who installs: workspace owners and admins, through the new project
  permission `project.app_installation.create`, next to the existing
  `project.app_installation.read` and `revoke`. It is never inherited from
  the organization, and platform staff get no exception: to install on a
  workspace, a staff member is an admin of it.

### 2.3 Tokens

* The code exchange returns an access token and a refresh token for the
  installation. The access token is an `at+jwt` signed by the API, valid one
  hour, whose subject is the installation's service user, with the
  installation id, and whose audience is the apps API (`<API>/api/apps/v1`).
* Refresh tokens rotate at each use and expire after 90 days without use.
  A reused refresh token revokes the grant and the installation.
* `apps/v1/*` accepts these tokens only. The installation is loaded on each
  request: revoking it from the studio stops the app at once.
* Revoking an installation revokes its grant, and the other way round.

### 2.4 No transition

* The old flow goes in the same change: `apps/install/:slug`,
  `apps/v1/install/exchange`, `apps/v1/token`, the App JWT, the
  per-installation credentials, and the global `app.install` permission,
  which only those endpoints checked.
* Installations made with the old flow are revoked, since their credentials
  no longer work. Their apps install again from the consent page once they
  speak OAuth.

## 3. Consequences

* An app keeps one secret, instead of one per workspace, and one refresh
  token per workspace.
* The apps drop their hand-written OAuth code for a standard client.
* Workspace admins connect apps without the platform team.
* The "connected apps" list of a person shows their MCP clients only; app
  installations stay listed per workspace in the studio.
