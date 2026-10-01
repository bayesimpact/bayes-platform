# ADR 0021: Generic OpenID Connect and Access Granted by Email

* **Status**: Accepted, section 2.2 amended by [ADR 0022](0022-in-app-invitations.md)
* **Date**: 2026-09-28
* **Deciders**: Jérémie
* **Supersedes**: [ADR 0001](0001-single-default-auth0-organization.md), and the invitation mechanics of [ADR 0008](0008-agent-human-evaluation-model.md) and `docs/specs/project-memberships.md`
* **Scope**: `apps/api` (`domains/auth`, `domains/users`, `domains/member-grants`, Bull Board), `apps/web` (auth, member screens), API contracts, Helm chart.
* **Issue**: [#148](https://github.com/bayesimpact/bayes-platform/issues/148)

---

## 1. Context

The platform was tied to Auth0: the SPA and React SDKs in the web app, the
Management API (machine-to-machine client) to create users and send
invitation emails, the Auth0 organization flag at login, and an `auth0_id`
column. Customers who self-host want to plug their own identity provider,
Keycloak first.

Invitations were also Auth0 features: Auth0 sent the email and its ticket id
was the invitation token the app accepted after login. Without Auth0, the
platform would need its own email delivery to keep that flow.

## 2. Decision

**Any OpenID Connect provider authenticates users. The platform sends no
email: an admin adds people by email and the access is granted right away.**

### 2.1 Authentication

* The API validates RS256 access tokens against the provider's JWKS. The
  JWKS and userinfo endpoints come from the discovery document of
  `OIDC_ISSUER_URL`, which must equal the `iss` claim. `OIDC_AUDIENCE` is
  checked when set (Keycloak sets none by default).
* The web app uses `oidc-client-ts` (authorization code + PKCE, refresh
  tokens through `offline_access`). `oidcAudience` is sent as an extra
  `audience` authorize parameter for providers that need it (Auth0).
* `OIDC_AUTHORIZATION_PARAMS` adds provider-specific authorize parameters
  without provider-specific code, for example `organization` to keep an
  Auth0 application restricted to one organization.
* Bull Board keeps `express-openid-connect`, pointed at the same provider
  with a confidential client of its own (`BULL_BOARD_OIDC_*`).
* One provider per install. `user.auth_subject` holds the `sub` claim.

### 2.2 Access by email

> Amended by [ADR 0022](0022-in-app-invitations.md): adding someone by email now
> creates an invitation that the person accepts in the app. The linking rules
> below are unchanged.

* Adding a member (project, agent or review campaign) by email creates the
  memberships immediately (`POST /member-grants`). An unknown email gets an
  account with a NULL subject, shown as "never signed in".
* At the first sign-in, the API looks the user up by `sub`. If unknown, it
  reads userinfo and links the account that has the same email, which picks
  up every access granted to it. An unknown email gets a new account without
  access, and the web app shows a "no access yet" page.
* Linking by email requires `email_verified: true` (OpenID Connect Core 1.0,
  section 5.1). Without it the sign-in is refused with an explicit message:
  a provider that does not verify emails would let anyone take over an
  account by registering its email. `OIDC_TRUST_UNVERIFIED_EMAIL=true` lifts
  the check for a single-tenant provider the customer fully controls;
  `OIDC_ALLOW_EMAIL_LINKING=false` disables linking altogether.
* The same rule moves an install from one provider to another: the new `sub`
  is linked to the existing account through its verified email.

## 3. Rationale

This is the common model of self-hostable tools with generic OIDC (GitLab,
Grafana, Langfuse, Outline): just-in-time accounts at first sign-in, linking
by email as an explicit, guarded option, and an email flow that is optional.
It needs no email infrastructure and no provider-specific API, so any
provider works. Customers with an identity provider already create accounts
and tell their people; a second email from the platform added little.

Group-to-role mapping from a `groups` claim and SCIM provisioning (automatic
deprovisioning) are possible additions for enterprise installs. They are not
needed to replace Auth0.

## 4. Consequences

* **Positive:** no dependency on Auth0 or any provider API, no email
  delivery to operate, one configuration model for SaaS and self-hosted
  installs. Access shows up immediately, without an accept step.
* **Negative:** the platform does not tell people they were given access;
  the customer does. There is no explicit consent step: access given by an
  admin applies at the next sign-in.
* **Security:** everything rests on the provider verifying emails. The
  installation docs ask for "email verified" on accounts (Keycloak leaves it
  unchecked on admin-created users unless told otherwise).
* **Migration:** the database migration turns pending invitations into the
  memberships their acceptance would have created, in SQL frozen at the time
  of writing, so every install converts them at upgrade without a manual step.
  The `invitation` table is kept for one release to allow a rollback, then a
  later migration drops it. The steps for an existing install are in
  [docs/upgrading/auth0-to-oidc.md](../upgrading/auth0-to-oidc.md).
