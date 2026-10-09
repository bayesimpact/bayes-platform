# ADR 0024: Conversation Apps

* **Status**: Proposed
* **Date**: 2026-10-08
* **Deciders**: Jérémie, Didier
* **Extends**: Apps V0 (`domains/apps`: AppManifest, AppInstallation, App JWT) and [ADR 0019](0019-rbac-permission-catalog.md)
* **Scope**: `apps/api` (`domains/apps`, `domains/public-chat`, `domains/rbac`), `apps/web` (Studio apps screens), API contracts.

---

## 1. Context

An App installs on a workspace, gets a service user with a role limited to
what the admin granted, and calls `apps/v1` with an App JWT. Apps V0 was built
for content ingestion: documents, document sources and document tags.

The next Apps are conversation channels: a messaging platform where people
write to an agent, with the App relaying messages between that platform and
the agent. Apps V0 leaves five gaps for them:

* **Installation from a hosted web app.** `authorizeInstall` accepts only a
  loopback redirect and puts the `clientSecret` in the redirect URL. That fits
  a command line tool. A secret in the URL of a web app ends up in proxy logs
  and browser history.
* **Who installs.** `app.install` is a global permission held by platform
  staff. A workspace admin cannot connect a channel on their own.
* **Linking the App's own users.** An App that stores per-workspace settings
  has its own users, and must know which of them connected which workspace.
  The install flow does not carry that link back.
* **No conversation API.** No route lets an App talk to an agent, and no
  permission on agents can be granted to an App.
* **Revocation.** A revoke stopped new tokens, but a JWT issued before kept
  every permission of the installation until it expired, up to one hour.

The public chat (`/public/v1`) already holds the conversation engine for
people who are not signed in: published settings, sub-agent handoff
(ADR 0018), post-turn classification (ADR 0016), retention purge and public
analytics, all on `PublicAgentSession`.

## 2. Decision

**A conversation App is an App granted `agent.read` and
`agent.conversation.session.external.create`. It installs from a web app with an
authorization code, keeps its own users, and talks to agents through
`apps/v1`. Its conversations are public agent sessions tied
to the installation.**

### 2.1 Installation from a web app

* Done in #969 and #973. `AppManifest` carries `allowedRedirectUris`: the
  exact `https` callbacks an install may return to, set in the back-office.
  Loopback URLs stay accepted for command line tools.
* `authorize` returns a single-use code, valid for five minutes and stored
  hashed, never the credentials. The installing client sends a PKCE S256
  challenge when it starts the install, then exchanges the code server to
  server on `POST apps/v1/install/exchange` with its verifier, and receives
  its `client_id` and `client_secret` once. The flow is described in
  `docs/app-install.md`.
* A project-scoped install permission lets workspace owners and admins
  install an App on their workspace. `app.install` stays the global grant for
  platform staff.

### 2.2 The App's own users

* An App signs people in on its own, with any OpenID Connect provider, the
  platform's included, and stores its users. The platform does not
  authenticate an App's users and is not asked at runtime what they may do.
* A signed-in App user connects a workspace by starting the install flow
  from the App. The `state` the App sends to `authorize` comes back on its
  callback, which ties the new installation to the App user who started it.
  The App decides who else may manage that workspace on its side.
* Installing still requires a platform user with the install permission on
  the workspace, who consents on the platform's screen. Revoking the
  installation in the Studio cuts the App's access whatever its own users
  are.
* `AppManifest` gets an `appUrl`. The Studio lists the workspace's
  installations with an **Open** link to it.

### 2.3 Permissions

* `agent.read` exists and is checked on the agent. It is added to
  `APP_GRANTABLE_PERMISSIONS`. The App's project role passes it down to every
  agent of the workspace.
* `agent.conversation.session.external.create` is new: open a conversation on
  behalf of people outside the platform, and send their messages. It is granted on no
  catalog role and exists only in `APP_GRANTABLE_PERMISSIONS`. It is added to
  `RESOURCE_TYPE_PERMISSIONS_MAP.agent` so the App's project role passes it
  down. The consent screen labels it plainly: the App can expose the
  workspace's agents to anyone who writes to it.
* Conversations of signed-in members use `agent.conversation.session.*`, and
  `agent.conversation.session.playground.*` for draft settings. The external
  key sits in the same family. An App never gets the member or playground
  keys: it talks for people outside the platform, with published settings.

An installation is not bound to one agent. It reaches every agent of its
workspace, and the App decides which agent answers on which channel.

### 2.4 Conversation API

* `GET apps/v1/projects/:projectId/agents` lists the agents the App may use,
  through `PermissionService.listResourceIds(userId, "agent.read")` limited to
  the conversation agents of the installation's project.
* `POST apps/v1/projects/:projectId/agents/:agentId/conversations` opens a
  conversation for an `externalUserId` chosen by the App. The value is opaque
  to the platform: an App sends a salted hash, never a phone number or an
  email.
* `POST .../agents/:agentId/conversations/:conversationId/messages` sends the
  user's text and
  returns the full reply, after every handoff turn, in one JSON response. A
  messaging channel shows complete messages, so streaming adds nothing. An
  SSE variant can come later for a channel that edits messages live.
* The first version of the reply carries the text only. Cited sources, MCP App
  cards and conversation forms come later as typed parts, which a channel
  unable to render them replaces with a short text.

### 2.5 Sessions

* A conversation is a `PublicAgentSession`. The table gets
  `app_installation_id`. `embed_config_id` and `session_token_hash` become
  nullable, with a check that exactly one of `embed_config_id` and
  `app_installation_id` is set. `externalVisitorId` holds the App's
  `externalUserId`.
* An embed config is unique per agent and cascades its deletion to its
  sessions, and creating one opens a public embed token on the agent. Tying
  App conversations to it would mix two channels, so the column becomes
  nullable instead.
* `PublicSessionTokenGuard` compares the session's `embedConfigId` with the
  embed of the URL. An App session has none, so it can never be opened
  through `/public/v1`.
* The public chat service layer is shared: an App message runs the same
  `runHandoffTurns` loop, on the published settings, with the same
  classification and retention. The public chat contract does not change.
* Studio sessions and analytics show the channel: the embed, or the App name.

### 2.6 Revocation

* Done in #954. `resolveAppPrincipal` refuses a token whose installation is
  not active. A revoke cuts access at once, including for a JWT issued
  before.
* `AppManifest` gets a `webhookUrl`. A revoke sends it a signed
  `installation.revoked` event, so the App stops serving that workspace and
  deletes what it stored for it.

### 2.7 The `apps/v1` contract

Once third parties build on `apps/v1`, it is as frozen as `/public/v1`. The
conversation routes ship with the same guards as the public chat: a version
constant, type pins on the DTOs and an e2e contract spec. A follow-up extends
`docs/public-api-contract.md` to cover `apps/v1`, or gives it its own contract
file.

## 3. Rationale

A channel built as an App keeps the messaging platform's secrets, webhooks
and rules out of the API, and the conversation API serves every later channel
with no change to the platform. The RBAC model of Apps V0 already answers who
may connect a channel and what it may reach.

`agent.conversation.session.external.create` is its own key because exposing an agent
to anonymous people is a different decision from chatting with it as
yourself, as enabling the embed is. Sharing one key would hide that decision
on the consent screen.

Reusing `PublicAgentSession` gives App conversations the handoff,
classification, retention and analytics of the embed on day one. Each of
these has one branch for member sessions and one for public sessions. A third
session entity would need a third branch in each.

The authorization code keeps the client secret out of URLs, the same reason
OAuth web clients do not use the implicit flow.

Letting each App keep its own users keeps the platform out of an App's
sign-in and screens, as for any third-party integration. The cost is that
removing someone from a workspace in the Studio does not remove them from an
App: its owner manages that. Revoking the installation is the platform's
lever, and it takes effect at once.

## 4. Consequences

* **Positive:** a workspace admin connects a channel without platform staff.
  The next channel is a new App on the same API.
* **Negative:** `apps/v1` becomes a contract to maintain. Rich replies degrade
  to text on channels that cannot render them.
* **Data protection:** an App keeps its own mapping from a person to a
  conversation. The platform purge does not reach it, so the App must apply
  the agent's retention, and delete its data on `installation.revoked`.
* **Migration:** `public_agent_session` gets `app_installation_id`, and
  `embed_config_id` and `session_token_hash` become nullable, with the check
  constraint. `app_manifest` gets `app_url` and
  `webhook_url`. Existing rows are untouched.

## 5. Open questions

* Does the platform need to push messages to an App (a human takeover, a
  reminder), which would add outbound events beyond `installation.revoked`?
* Is rate limiting per installation needed before third parties get access?
* Should agent memory (ADR 0023) apply to an `externalUserId`, which is stable
  for a given person on a given channel?
