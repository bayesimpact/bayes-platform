# Feature Specification: Review Campaigns — Tester Experience (v1)

> **Companion documents:** [ADR 0008 — Conversational Agent Human Evaluation Model](../adr/0008-agent-human-evaluation-model.md) for the "why" behind every decision below. [Review Campaigns — Reviewer Experience (v1)](./review-campaigns-reviewer-v1.md) for the Level-2 flow that builds on this foundation.

> **Superseded for invitations** by [ADR 0022](../adr/0022-in-app-invitations.md): people are invited by email and accept the invitation in the app, with no invitation email. The Auth0 parts below are historical.

## Overview

Workspace admins can create a **review campaign** targeting a specific agent, invite **testers** to use it, and collect structured feedback. Testers interact with the agent through the normal user UI augmented with post-session feedback (5-star rating, predefined questions, free comment) and an optional one-time end-of-phase survey.

This spec covers the **foundation** of the review-campaigns domain (entities, memberships, lifecycle) as a prerequisite, plus the full **Level-1 (tester)** flow. The Level-2 (reviewer) flow is delivered by the companion spec on top of this foundation.

---

## Scope (v1)

### In Scope

**Foundation (prerequisite for both L1 and L2):**
- `review-campaigns` NestJS domain at `apps/api/src/domains/review-campaigns/`.
- Entities: `ReviewCampaign`, `ReviewCampaignMembership`, `TesterSessionFeedback`, `TesterCampaignSurvey`.
- Campaign lifecycle (draft → active → closed, one-way).
- Three campaign-level predefined-question lists (tester per-session, tester end-of-phase, reviewer) configurable at campaign creation and while in draft.
- Auth0 invitation reuse for tester/reviewer invites.

**Tester experience (L1):**
- Workspace admin: campaign CRUD, invite testers by email, activate campaign.
- Tester: lands directly in the campaign from an email invite, sees the invited agent, drives sessions using the existing user-side chat UI.
- Post-session feedback capture (blocking modal at session close): 5-star, free comment, required predefined questions.
- End-of-phase survey: one-time submission per (tester, campaign), accessible from a "Finish participating" action.
- All feedback editable by its author until the campaign is closed.

### Out of Scope (v1)

- Reviewer browsing / reviewing sessions — covered by the companion spec.
- Assigned scenarios (testers always use free exploration in v1; `scenario_id` slot reserved on the session — see §5).
- Anonymous testers.
- Reopening a closed campaign.
- Cross-campaign analytics.
- Agent versioning (campaign scoped to `agent_id` directly; see ADR §2.3).

---

## Core Product Decisions

All load-bearing decisions are in ADR 0008. Restated here only where needed for implementers:

1. **Campaign → Agent FK.** A campaign targets exactly one agent. If later the same agent needs another round of evaluation, it's a new campaign.
2. **Free exploration only.** No assigned scenarios; testers start as many sessions as they want inside the campaign.
3. **Feedback is blocking at session close.** Tester cannot dismiss the rating modal without either submitting or explicitly abandoning the session (an abandoned session is still listed for reviewers but has no tester feedback record).
4. **End-of-phase survey is optional** (ADR §2.11; confirmed rejection of mandatory variant in §3 of the ADR).
5. **Feedback/survey editable while campaign is active.** Freezing happens at campaign close.
6. **One `TesterSessionFeedback` per session, authored by the session's tester.** Uniqueness enforced at the DB level on `(session_id)`; the tester is implicit from the session.
7. **Invite reuses Auth0 flow.** See `docs/specs/auth0-invitation-sending.md`. Campaign invites piggy-back on the same token/redirect machinery with a `targetCampaignId` payload so the post-accept redirect lands in the campaign.
8. **Roles model follows ADR 0004.** A new membership table, no implicit inheritance; workspace admins are not automatically campaign members.

---

## Data Model

### New Entities

All entities extend `ConnectEntityBase` and follow existing TypeORM / column-naming conventions (snake_case columns, camelCase fields).

#### `ReviewCampaign`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `organization_id` | uuid (FK → `organization`) | Inherited from `ConnectEntityBase`. Scopes the campaign; drives auth. |
| `project_id` | uuid (FK → `project`) | Inherited from `ConnectEntityBase`. "Workspace" in the UI maps to Project in the code. |
| `agent_id` | uuid (FK → `agent`) | The target agent. Future: `agent_version_id` (ADR §2.3). |
| `name` | varchar | Admin-facing. |
| `description` | text (nullable) | Admin-facing explanation, also shown to invitees on landing. |
| `status` | varchar | `draft \| active \| closed`. |
| `tester_per_session_questions` | jsonb | Array of `{id, prompt, type, required}`. Type: `rating \| single-choice \| free-text`. Single-choice includes `options`. |
| `tester_end_of_phase_questions` | jsonb | Same shape. |
| `reviewer_questions` | jsonb | Same shape — consumed by the reviewer spec but stored here. |
| `activated_at` | timestamptz (nullable) | Set on draft → active. |
| `closed_at` | timestamptz (nullable) | Set on active → closed. |
| `created_at`, `updated_at` | timestamptz | Inherited. |

#### `ReviewCampaignMembership`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `campaign_id` | uuid (FK → `review_campaign`) | |
| `user_id` | uuid (FK → `user`) | |
| `role` | varchar | `tester \| reviewer`. One row per (campaign, user, role) — a user may hold both roles with two rows. |
| `invited_at` | timestamptz | |
| `accepted_at` | timestamptz (nullable) | Set on invite acceptance. |

Unique: `(campaign_id, user_id, role)`.

#### `TesterSessionFeedback`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `campaign_id` | uuid (FK → `review_campaign`) | Denormalized for aggregation queries. |
| `session_id` | uuid | Polymorphic FK — see §5. |
| `session_type` | varchar | `conversation \| extraction \| form`. |
| `overall_rating` | smallint | 1–5. Not null. |
| `comment` | text (nullable) | |
| `answers` | jsonb | Array of `{questionId, value}` matching the campaign's `tester_per_session_questions`. |
| `created_at`, `updated_at` | timestamptz | |

Unique: `(session_id)`.

#### `TesterCampaignSurvey`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `campaign_id` | uuid (FK → `review_campaign`) | |
| `user_id` | uuid (FK → `user`) | |
| `overall_rating` | smallint | 1–5. |
| `comment` | text (nullable) | |
| `answers` | jsonb | Array of `{questionId, value}` matching `tester_end_of_phase_questions`. |
| `submitted_at` | timestamptz | |
| `created_at`, `updated_at` | timestamptz | |

Unique: `(campaign_id, user_id)`.

### Session Polymorphism

`TesterSessionFeedback.session_id` is not a hard FK — it can point to `conversation_agent_session`, `extraction_agent_session`, or `form_agent_session`. The `session_type` column disambiguates. Rationale: matches the existing `base-agent-sessions` pattern already in use by the streaming and messages domains; adding three separate feedback tables would explode the surface area with no gain.

Campaign access checks must resolve the session → agent → verify agent matches `campaign.agent_id`.

### Inverse Relations on Existing Entities

- `Project` gains `@OneToMany(() => ReviewCampaign, …) reviewCampaigns`.
- `Agent` gains `@OneToMany(() => ReviewCampaign, …) reviewCampaigns`.
- `User` gains `@OneToMany(() => ReviewCampaignMembership, …)` and `@OneToMany(() => TesterCampaignSurvey, …)`.
- The three agent-session entities each gain a nullable `campaignId` column and `@ManyToOne(() => ReviewCampaign)` relation.

> **Note on "workspace":** The product UI says "workspace"; in the codebase there is no `Workspace` entity — all multi-tenancy goes through `ConnectEntityBase` which provides `organizationId` + `projectId`. A "workspace" in the UI corresponds to a Project in the data model. Throughout this spec, "workspace admin" = admin on the campaign's Project (ADR 0004 explicit-membership model).

### Migrations

All schema changes are generated in a single pass via `npm run migration:generate` (producing one migration file covering the four new tables + the three `campaign_id` column additions). Never hand-write migrations; the generated file is the source of truth. This supersedes any earlier "one migration per entity" guidance.

---

## Authorization

Follows ADR 0004 explicit-membership rules:

- **Campaign CRUD:** caller must have a `ProjectMembership` with `admin` role on the campaign's project (the "workspace" in UI copy).
- **Tester actions** (start session in campaign, submit feedback, submit survey): caller must have a `ReviewCampaignMembership` with role `tester` on the campaign, and the campaign must be `active`.
- **Read campaign landing page** (post-invite-accept): same as tester actions, or reviewer (the reviewer spec handles that branch).
- **Session creation within a campaign:** uses the existing agent session creation path, augmented with a `campaign_id` on the request. The agent session entities get a nullable `campaign_id` column (one migration on each of the three session tables) so sessions outside a campaign continue to work unchanged.

No cascading inheritance: a project admin is not automatically a campaign tester. If they want to dogfood, they invite themselves (ADR §2.10 permits dual roles).

---

## API

All routes use `defineRoute` and live in `packages/@caseai-connect/api-contracts/src/review-campaigns/review-campaigns.routes.ts`. DTOs in the sibling `review-campaigns.dto.ts`.

### Admin routes (workspace admin)

| Method | Path | Purpose |
|---|---|---|
| POST | `organizations/:organizationId/projects/:projectId/review-campaigns` | Create (starts in `draft`). |
| GET | `organizations/:organizationId/projects/:projectId/review-campaigns` | List campaigns in workspace. |
| GET | `review-campaigns/:campaignId` | Full detail (config + memberships + aggregates). |
| PATCH | `review-campaigns/:campaignId` | Edit name/description/questions (draft only); activate/close (lifecycle transitions). |
| DELETE | `review-campaigns/:campaignId` | Draft only. |
| POST | `review-campaigns/:campaignId/invitations` | Invite one or more users (tester or reviewer) by email; triggers Auth0 invitation. |
| DELETE | `review-campaigns/:campaignId/memberships/:membershipId` | Revoke. |

### Tester routes

| Method | Path | Purpose |
|---|---|---|
| GET | `me/review-campaigns` | Campaigns the caller is a tester of (active only). |
| GET | `review-campaigns/:campaignId/tester-context` | Campaign summary + agent snapshot + question lists for display. |
| POST | `review-campaigns/:campaignId/agent-sessions` | Start a new agent session inside the campaign. Creates the appropriate `*_agent_session` row with `campaign_id` set. |
| POST | `agent-sessions/:sessionId/tester-feedback` | Submit feedback; 422 if not in a campaign, 409 if already submitted. |
| PATCH | `agent-sessions/:sessionId/tester-feedback` | Update own feedback while campaign is active. |
| POST | `review-campaigns/:campaignId/tester-survey` | Submit end-of-phase survey; 409 if already submitted. |
| PATCH | `review-campaigns/:campaignId/tester-survey` | Update own survey while campaign is active. |

### Invitation redirect

The Auth0 invitation acceptance flow (per `docs/specs/auth0-invitation-sending.md`) terminates at a callback. The callback resolves any pending `ReviewCampaignMembership` rows for the user, marks them `accepted_at = now()`, and redirects the browser to the campaign landing page (`/review-campaigns/:campaignId` in the tester app surface).

---

## UI / UX

### Studio (admin)

Locations: `apps/web/src/studio/features/review-campaigns/`.

- **Campaign list page** (under workspace): table of campaigns with status pill, counts (testers, reviewers, sessions, feedback submitted), created date, actions.
- **Campaign editor** (create + edit, draft only):
  - **General** tab: name, description, target agent (dropdown of workspace's agents; locked after activation).
  - **Questions** tab: three editable lists (tester per-session / tester end-of-phase / reviewer), each with add/remove/reorder. Each question has prompt, type, options (for single-choice), required toggle.
  - **Participants** tab: add testers by email (bulk paste), add reviewers by email, see invited vs accepted, revoke.
  - **Preview** tab: read-only render of what testers will see (feedback modal + survey) — helps the admin check question ordering and phrasing.
- **Lifecycle actions** (top of editor): "Activate" (draft → active, confirms locking of questions and agent), "Close" (active → closed, confirms feedback freeze).
- **Closed campaign view**: read-only summary, link into aggregates (the full aggregate report is part of the reviewer spec; in this spec only tester-side rollups are shown — mean tester rating, survey counts, N sessions).

### Tester surface

Locations: `apps/web/src/` — a new **tester** route tree (alongside `studio` and `eval` if the repo uses that split; implementer confirms at build time) with minimal chrome.

- **Landing** (`/review-campaigns/:campaignId`): campaign name + description, agent card, "Start a conversation" CTA, list of past sessions with their feedback status, "Finish participating" action.
- **Session UI**: the existing user-side chat (conversation/extraction/form agent UI, unchanged), with a discreet "End session" button that opens the feedback modal.
- **Feedback modal** (blocking): overall 5-star + comment + per-session questions. Cannot submit without filling required questions. "Skip and abandon session" secondary action records an abandoned session without feedback.
- **End-of-phase survey page**: triggered by "Finish participating"; shows overall rating + comment + end-of-phase questions. Submits and returns to landing marked "Participation finished" (tester can still start new sessions and edit their survey while campaign is active).
- **i18n:** localized strings via the existing `locales/*.json` mechanism (see `apps/web/src/common/features/agents/locales/`).

### Redux wiring

Per `apps/web/CLAUDE.md`: each feature gets `models.ts`, `spi.ts`, `external/*.api.ts`, `slice.ts`, `thunks.ts`, `selectors.ts`, registered in `external/axios.services.ts` and `di/services.ts`. No direct Axios from components.

New features: `review-campaigns` (admin), `review-campaign-participation` (tester).

---

## Testing

Following the API CLAUDE.md testing requirements.

### API

- **E2E auth spec** (`apps/api/src/domains/review-campaigns/e2e-tests/auth.spec.ts`): every route tested against no-token, non-member, wrong-role, correct-role.
- **E2E functional specs** (one per action): create-campaign, update-campaign, invite-tester, start-tester-session, submit-feedback, update-feedback, submit-survey, activate-campaign, close-campaign.
- **Service specs**: `review-campaigns.service.spec.ts`, `tester-feedback.service.spec.ts`, `tester-survey.service.spec.ts` — using `setupTransactionalTestDatabase` and fishery factories (`reviewCampaignFactory`, `reviewCampaignMembershipFactory`, `testerSessionFeedbackFactory`, `testerCampaignSurveyFactory` — new).
- **Membership factory** follows the existing pattern.

### Web

- Component tests + Storybook entries for the campaign editor tabs and the feedback modal.
- Redux thunk tests for the new slices.

### Completion Gates

Per both CLAUDE.md files: `npm run biome:check`, `npm run typecheck`, `npm run test` — exit 0.

---

## Open Questions

1. **Placement of the tester surface.** The repo has `studio/` (admin) and `eval/` (evaluation) route trees; confirm during implementation whether the tester UI lives in a new `tester/` tree or under `common/` with campaign-mode gating. Does not affect data model.
2. **Abandoned sessions.** Definition: a session where the tester left without opening the feedback modal. Proposal: idle timeout on the session + explicit "abandon" action from the modal. Exact policy deferred to implementation.
3. **Invite by email for non-existent Auth0 users.** The existing invitation spec covers this, but campaign invites may want a different email template/copy. Proposal: reuse template with a campaign-specific subject/body variant.
4. **Bulk invite limits.** Any cap on emails per call? Proposal: 100, configurable.

---

## Milestones

1. **Foundation migrations & entities.** `ReviewCampaign`, `ReviewCampaignMembership`, `TesterSessionFeedback`, `TesterCampaignSurvey` + `campaign_id` columns on the three agent-session tables.
2. **Admin API** — campaign CRUD, lifecycle transitions, invitations.
3. **Admin UI** — campaign editor (all four tabs), list page, lifecycle actions.
4. **Tester API** — tester-context, start session, submit feedback, submit survey.
5. **Tester UI** — landing, feedback modal, survey page.
6. **Invite acceptance redirect** into the campaign.
7. **Aggregate rollups** (tester-side) on the admin closed-campaign view.

Milestones 2–3 and 4–5 can proceed in parallel once 1 is merged.
