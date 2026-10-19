# ADR 0030: Local sign-in through a profile picker

* **Status**: Accepted
* **Date**: 2026-10-19
* **Deciders**: Jérémie
* **Amends**: [ADR 0025](0025-worktree-dev-environments.md) (the sign-in of each environment)
* **Scope**: Local development: `infra/oidc-picker/`, `infra/database/` (`oidc-picker` profile), `infra/worktree/`.

---

## 1. Context

Local sign-in ran on Dex: the main checkout's on port 5556 and one per worktree environment
(ADR 0025). Dex gave every person of the local database a static password, the same local dev
password for all, kept hashed on the machine. To test as someone else, a developer signed out and
typed that person's email and the shared password. Dex keeps its signing keys in memory, so each
restart signed everyone out. Its issuer carried a `/dex` path.

## 2. Decision

**Local sign-in runs on [oidc-picker](https://github.com/bayesimpact/oidc-picker), a small OpenID
Connect provider built on node-oidc-provider. Its sign-in page lists the people of the database,
and a click signs in as that person, without a password.**

- The main checkout's picker runs under the `oidc-picker` profile of `infra/database`, issuer
  `http://localhost:5556`. `infra/oidc-picker/sync-users.mjs` lists the people of the local
  database in it.
- Each worktree environment runs its own, the `auth` service, issuer
  `<scheme>://<name>-auth.<domain>`, at the root, with no `/dex` path. The worktree tooling writes
  its configuration with `infra/oidc-picker/picker-config.mjs`.
- Each person's `sub` is their platform id. At the first sign-in, the API links the new identity to
  the account by verified email (ADR 0021), so nothing is lost when moving from Dex.
- The picker reads its profiles again when their file changes: someone added to the database is
  listed without a restart. An environment's picker keeps its signing keys in the environment's
  folder, so a restart keeps people signed in.
- There is no local dev password any more.

An environment reachable from outside the machine sits behind a gatekeeper that signs people in
first. The picker then requires the header the gatekeeper sets (`actorHeader`), logs who picked
which profile, and turns its password grant off. The gatekeeper belongs to the team's tooling, not
to this repository.

## 3. Consequences

- Switching between people takes one click, which is what testing permissions needs.
- The picker signs in anyone who reaches it. It refuses to start on a non-local issuer unless told
  to, and never runs in production.
- Keycloak stays available (`keycloak` profile) to test what is specific to a full provider.
