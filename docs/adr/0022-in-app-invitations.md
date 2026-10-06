# ADR 0022: In-app invitations without email

* **Status**: Accepted
* **Date**: 2026-10-01
* **Deciders**: Jérémie
* **Amends**: section 2.2 of [ADR 0021](0021-generic-oidc-and-access-by-email.md) (access by email)
* **Scope**: `apps/api` (`domains/invitations`, `domains/users`, `domains/rbac`), `apps/web` (onboarding, member screens), API contracts.

---

## 1. Context

ADR 0021 replaced Auth0 with any OpenID Connect provider and removed the
invitations along with Auth0's email delivery. Adding someone by email
granted the access right away.

That lost a step people relied on: being told about a workspace, an agent
or a campaign and choosing to join it. The email was the part tied to
Auth0. The acceptance step was not.

## 2. Decision

**Adding someone by email creates an invitation. The person accepts or
declines it in the app after signing in. Emailing the invitation is optional.**

* Each target has its invitation routes under its own path:
  `.../projects/:projectId/invitations`, `.../agents/:agentId/invitations` and
  `.../review-campaigns/:reviewCampaignId/invitations`. Creating makes one
  pending invitation per email. It grants nothing. People who already have
  the access, or a pending invitation for it, are skipped.
* An unknown email gets an account with a NULL subject, as in ADR 0021. The
  first sign-in links it through the verified email (`email_verified`, same
  rules and settings). The invitation points to that account, so only the
  person whose verified email matches can see and accept it.
* The onboarding page lists the caller's pending invitations
  (`GET /me/invitations`) with **Accept** and **Decline**. Accepting creates
  the memberships the old member grant created, in one transaction. A
  review campaign invitation can only be accepted while the campaign is
  active.
* Admins see the pending invitations of a target and can revoke them.
  Revoking the last thing an account that never signed in holds deletes that
  account.
* The admin routes check RBAC permissions ([ADR 0019](0019-rbac-permission-catalog.md)):
  `project.member.invite` for a project and its review campaigns (project
  owner and admin), `agent.member.invite` for an agent (agent owner and
  admin). Neither is inherited from a parent resource. The routes of the
  invited person need no permission: they only reach the caller's own
  invitations.
* Everyone accepts, including people who already have an account.
* Each pending invitation has a link to copy: `<app>/?login_hint=<email>`. The
  app forwards `login_hint` (OIDC Core 1.0, section 3.1.2.1) to the provider,
  which pre-fills the email on its sign-in and sign-up screens. The link
  carries no token and grants nothing.
* When `SMTP_HOST` is set, the platform also emails each new invitation with
  that link, in English and French, over plain SMTP (any server). The email is
  sent after the invitations are saved, and a failed email never fails the
  invitation. Links use `APP_PUBLIC_URL`, or the first `FRONTEND_URL` entry.
  Without SMTP nothing is sent and the admin copies the link.
* The `invitation` table is reused. `invitation_token` keeps its unique
  constraint and gets a random value: acceptance goes through the invitation
  id and the caller's identity, never a token.

## 3. Rationale

Matching the invitation to an account, and not to an email at sign-in time,
keeps a single place where an email is trusted: the verified-email link in
`UsersService.findOrCreate`. An account created from an unverified email
never sees invitations sent to that address.

Keeping the accept step in the app needs no email infrastructure, so it
works with any provider, like the rest of ADR 0021.

## 4. Consequences

* **Positive:** people choose what they join, and admins see who has not
  answered yet.
* **Negative:** without SMTP, nobody is told about an invitation outside the
  app: the admin sends the link. The platform does not create accounts in the
  identity provider, so the person may still have to sign up there.
* **Migration:** none. The memberships that ADR 0021's migration created from
  pending invitations stay. People added by email before this change keep
  their access without an invitation.
