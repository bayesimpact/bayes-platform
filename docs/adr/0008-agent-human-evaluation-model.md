# ADR 0008: Conversational Agent Human Evaluation Model

* **Status**: Accepted
* **Date**: 2026-04-21
* **Deciders**: Jérémie
* **Scope**: A new domain (`review-campaigns`) for human evaluation of conversational agents, spanning `apps/api`, `apps/web`, and `packages/@caseai-connect/api-contracts`.

---

## 1. Context and Problem Statement

We need to evaluate conversational agents with humans in the loop, at two levels:

1. **Testers** interact with an agent through a UI close to the normal end-user experience, but with structured feedback after each session (per-session ratings, predefined questions, free comment) and a one-time end-of-phase survey.
2. **Reviewers** browse tester sessions after the fact and add their own score and comments on the session as a whole.

This produces two complementary signals per agent:

* **Perceived quality / satisfaction**, captured from testers — measured both per-conversation (while the memory is fresh) and once at the end of the test phase (overall sentiment).
* **Expert-judged quality / business value**, captured from reviewers — measured per-session against dimensions the campaign owner cares about (correctness, completeness, guardrail adherence, etc.).

The two levels are deliberately complementary: testers answer "how did this feel?", reviewers answer "was it right?". Neither signal alone is sufficient.

A number of shape-defining choices must be made before any UI or schema is drawn up:

* How the two roles interact (is reviewer judgement blind to tester feedback?).
* How sessions are sourced for testers (scripted scenarios vs. free exploration) and for reviewers (exhaustive vs. sampled).
* How individual ratings roll up into a campaign-level verdict.
* How this fits alongside the **existing** `evaluations` domain, which today handles automated golden-set evaluation (`Evaluation` has `input` / `expectedOutput` and `reports`) and must not be conflated with human evaluation.
* How access is granted to testers and reviewers, relative to ADR 0004's explicit-membership model.

This ADR locks in those shape decisions. Two feature specs (tester experience, reviewer experience) will then be written against this foundation.

## 2. Decision

### 2.1 Domain and Naming

A new domain is introduced: **`review-campaigns`**. The existing `evaluations` domain keeps its current meaning (automated/golden-set evaluation) and is not extended.

Rationale for the name: the **campaign is the root entity** (it owns testers, reviewers, sessions, questions, lifecycle), and the repo convention is to name domain folders after the pluralized main entity (`evaluations` → `Evaluation`, `documents` → `Document`, `projects` → `Project`). `review-campaigns` → `ReviewCampaign` lines up cleanly with that convention and with ADR 0004's membership naming (`ReviewCampaignMembership`). Alternatives (`agent-reviews`, `session-reviews`, `human-evaluations`, `evaluation-campaigns`) were rejected either because the folder/entity mismatch produced awkward class names, or because overloading the word "evaluation" with two different meanings carries a durable contributor-confusion cost (see §3).

Within `review-campaigns`, the core concepts are:

| Concept | Description |
|---|---|
| **Review campaign** (`ReviewCampaign`) | A scoped effort to evaluate a specific agent, with its own invited testers, invited reviewers, predefined questions, and lifecycle. |
| **Tester session feedback** (`TesterSessionFeedback`) | The rating + answers + comment a tester submits at the end of a session they drove. |
| **Tester campaign survey** (`TesterCampaignSurvey`) | The one-time end-of-phase submission a tester makes after their participation (see §2.11). |
| **Reviewer session review** (`ReviewerSessionReview`) | The rating + comment a reviewer submits against one tester session. |
| **Session** | Reuses the existing agent-session entities (`ConversationAgentSession`, `ExtractionAgentSession`, `FormAgentSession`). No separate session concept is introduced. |

### 2.2 Two-Level Structure

The model has exactly two levels:

* **Level 1 — Tester.** Drives a session, submits feedback against that session.
* **Level 2 — Reviewer.** Reads a tester's session transcript + tester feedback, submits a review.

There is no third level. If expert adjudication is needed later, it will be modeled as a second reviewer review on the same session, not a new role.

### 2.3 Agent Version Pinning (Deferred)

A review campaign is scoped to an **agent**, not an agent version. Agent versioning does not exist yet; when it is introduced, the campaign FK will move from `agent_id` to `agent_version_id` and historical campaigns will retain the snapshot they were run against. No other part of the model is affected.

Captured here so the future migration is a rename, not a redesign.

### 2.4 Assignment Model: Free Exploration (v1)

In v1, testers interact with the agent **freely** — there is no notion of assigned scenarios, scripts, or scoped tasks. Every session the tester starts within the campaign counts as a candidate for review.

**Deferred to a later iteration:** assigned scenarios (a campaign owner pre-writes a list of tasks, each tester must complete each task, coverage is tracked per tester × scenario). The data model must leave room for this — an optional `scenario_id` FK on the session is enough — but the feature itself is not built.

### 2.5 Blind Review

Reviewers write their score and comment **without seeing the tester's rating or comment first**. Only the conversation transcript and any predefined-question answers the tester gave (factual content) are shown during review. The tester's star rating and free-text opinion are revealed only after the reviewer submits.

Rationale: avoids anchoring. A reviewer who sees "tester gave 5 stars" before scoring is measurably biased toward that number; the point of a two-level eval is independent signal.

Implementation note: this is a UI-level guarantee (don't show the field) combined with an API guarantee (don't include tester opinion fields in the review-session payload for reviewers who have not yet submitted a review for that session).

### 2.6 Review Sampling and Coverage (v1)

Reviewers **self-serve**: they browse the list of sessions in a campaign and pick ones to review. There is no automatic assignment, no mandatory sample, no enforced coverage percentage.

Each session exposes aggregated review state (reviewer count, mean reviewer score) so a reviewer can avoid double-covering the same session unless they want to.

**Deferred:** reviewer assignment ("user X must review these N sessions"), coverage targets, reviewer load balancing, inter-rater agreement metrics.

Rationale: v1 is about getting signal at all, not optimizing coverage. Free browsing is fastest to ship and mirrors the free-exploration choice on the tester side.

### 2.7 Multiple Reviews Per Session

A given session can accumulate **zero, one, or many** reviewer reviews. No deduplication, no consensus algorithm, no forced reconciliation. All reviews are stored and surfaced as independent records.

A single reviewer can submit **at most one review per session** (unique constraint on `(session_id, reviewer_user_id)`), but may edit that review until the campaign closes.

### 2.8 Aggregation

Campaign-level reporting is intentionally simple in v1:

* Mean tester per-session rating, tester rating count.
* Mean reviewer rating, reviewer rating count.
* End-of-phase survey rollup: mean NPS, mean overall satisfaction, participant count (§2.11).
* Distribution of predefined-question answers, per list (per-session, end-of-phase, reviewer).
* Raw list of sessions with their tester and reviewer ratings side by side.

No weighted scoring, no reliability metrics, no outlier filtering. Heuristics can be added later once we have real data to validate them.

### 2.9 Predefined Questions

Predefined questions are configured **per campaign**, with three independent question lists per campaign:

| List | Answered by | When |
|---|---|---|
| **Tester per-session questions** | The tester who drove the session | At session close |
| **Tester end-of-phase questions** | Each tester, once | After they finish participating (see §2.12) |
| **Reviewer questions** | The reviewer | While reviewing a session |

Each question has:

* A prompt string.
* A type: `rating` (N stars), `single-choice` (enum of labels), or `free-text`.
* A required/optional flag.

On every list, a 5-star overall rating and a free comment are **always present** as first-class fields on the feedback/review/survey record (not part of the predefined list).

**Suggested dimensions** (campaign owners can pick these as starter templates — none are hard-coded):

* *Tester per-session*: perceived clarity of the agent's questions and answers, perceived relevance/usefulness of responses.
* *Tester end-of-phase*: Net Promoter Score, overall satisfaction.
* *Reviewer*: correctness of information, completeness of captured data, adherence to the agent's declared scope and escalation rules (generic guardrail adherence — e.g. "did the agent stay within its declared scope?", "did it escalate when configured to do so?").

These are suggestions in the UI, not schema constraints. The campaign owner composes whatever list makes sense for their agent.

### 2.10 Roles and Invite Flow

Consistent with ADR 0004's explicit-membership model, a new membership table is introduced:

| Table | Scope | Role enum |
|---|---|---|
| `ReviewCampaignMembership` | Review campaign | `tester \| reviewer` |

A single user can hold both roles on the same campaign (useful for workspace admins who want to dogfood both flows), but the UI should treat them as distinct modes to avoid self-reviewing.

**Invite flow:** workspace admins (per ADR 0004 §2.2) create campaigns and invite testers and reviewers by email, reusing the Auth0 invitation machinery already documented in `docs/specs/auth0-invitation-sending.md`. Invitees receive a link that lands them directly in the campaign — they do not need to navigate the workspace tree.

> Superseded by [ADR 0022](0022-in-app-invitations.md): admins invite testers and reviewers by email, and they accept the invitation in the app after signing in through the identity provider. The platform sends no email.

**Anonymous testers:** not supported in v1. Every tester must be an authenticated, invited user. Rationale: reviewer-to-tester attribution only makes sense with stable identities, and tester feedback quality is already a weak signal — anonymous feedback would be weaker still.

### 2.11 End-of-Phase Tester Survey

Separate artifact from per-session feedback: a tester answers the end-of-phase survey **once** per campaign, after they consider their participation done.

* Contains the campaign's tester end-of-phase questions (typically overall satisfaction + NPS, plus any free-form reflections).
* Submitted from a dedicated UI action ("Finish participating"), not automatically inferred from inactivity.
* Optional in v1 — a tester may leave without submitting; their per-session feedback still counts.
* One submission per (tester, campaign) — editable until campaign closes.

Rationale: per-session feedback captures fresh reactions; end-of-phase captures aggregate sentiment after exposure to the agent across many sessions. The two measure different things (moment-to-moment vs. overall), and collapsing them into one form loses signal.

### 2.12 Agent-Type-Aware Evaluation

Agents have a `type` field (`conversation | extraction | form`). Reviewer dimensions that make sense differ by type:

| Agent type | Natural reviewer dimension |
|---|---|
| `conversation` | Correctness / factual accuracy of responses |
| `extraction` | Correctness of extracted fields vs. source |
| `form` | Completeness — proportion of required schema fields correctly captured |

The campaign's reviewer question list is **free-form** (§2.9), so this is not a schema constraint. It is a UI concern: when a campaign owner creates a campaign for a form-type agent, the UI suggests the "completeness" template; for a conversation agent, it suggests correctness + guardrail adherence. Owners can override.

Guardrail adherence is cross-type and always suggested.

### 2.13 Campaign Lifecycle

A review campaign has three states:

1. **Draft** — being configured. No sessions yet. Visible only to the workspace admin who owns it.
2. **Active** — invitations sent, testers and reviewers can act. Feedback and reviews are mutable by their author.
3. **Closed** — read-only. Feedback and reviews are frozen. Aggregated reports are exportable.

Transitions are one-way: draft → active → closed. Reopening a closed campaign is out of scope for v1.

## 3. Alternatives Considered

* **Extend the existing `evaluations` domain.** Rejected. The existing domain is about automated eval against a golden set; conflating it with human review would produce an entity that means two different things depending on which fields are populated. Two clean domains are simpler.
* **Alternative domain names** (`agent-reviews`, `session-reviews`, `human-evaluations`, `evaluation-campaigns`). Rejected in favor of `review-campaigns` because:
    * `agent-reviews` / `session-reviews` — the real root entity is a campaign, not a "review", so the folder/entity mapping would be misleading (forcing `AgentReviewCampaign` or similar compounds).
    * `human-evaluations` / `evaluation-campaigns` — give two domains the word "evaluation" with distinct meanings (automated vs. human), a durable source of contributor confusion.
* **Three-level evaluation (tester + reviewer + adjudicator).** Rejected for v1. No evidence yet that reviewer disagreement needs a formal tie-breaker; modeling it as "a second reviewer" keeps the door open.
* **Open (non-blind) review.** Rejected. Anchoring is a known bias, and the cost of hiding one field in the reviewer UI is trivial compared to the cost of collecting biased data for weeks.
* **Assigned scenarios in v1.** Rejected. Doubles the surface area of the tester feature and is premature optimization until we know what kinds of scenarios matter. Left as a natural extension (§2.4).
* **Mandatory review coverage / reviewer assignment in v1.** Rejected. Same reason: premature until we know the reviewer pool size and willingness.
* **Consensus / agreement scoring in v1.** Rejected. Needs real data first to choose a metric that means something.
* **Mandatory end-of-phase survey.** Rejected. Making survey submission required to "close" participation would block testers who silently drop off, and their per-session feedback still has value. Survey stays optional (§2.11).

## 4. Consequences

* **Positive Impacts**:
    * **Independent signal.** Blind review ensures reviewer ratings are not downstream of tester ratings, so the two levels actually measure different things.
    * **Small blast radius.** A new domain means no risk of destabilizing the existing automated-eval domain, streaming, or agent-sessions modules.
    * **Additive data model.** Everything hangs off the existing agent-session entities (`ConversationAgentSession`, `ExtractionAgentSession`, `FormAgentSession` — all sharing the `base-agent-sessions` abstraction); no changes to the session/streaming path.
    * **Shippable in two specs.** Foundation is small enough to fit into the tester spec as a prerequisite section; no third "infrastructure" issue needed (see §5).
* **Negative Impacts / Risks**:
    * **Tester pool quality is untested.** Free exploration means sessions may cluster on the same happy paths; without assigned scenarios there's no guarantee of edge-case coverage. Accepted for v1; revisit if aggregated reports look thin.
    * **Reviewer self-selection bias.** Reviewers will pick "interesting" sessions first, skewing coverage toward outliers. Accepted for v1; surface reviewer-count-per-session so at least the skew is visible.
    * **Naming adjacency.** `evaluations` (automated) and `review-campaigns` (human) are conceptually close; the distinct vocabularies ("evaluation" vs. "review") reduce collision risk but do not eliminate it. Mitigation: add a short domain glossary to `apps/api/CLAUDE.md` when the feature lands, explicitly contrasting the two.
    * **No cross-campaign analytics.** Each campaign is an island; comparing agent A v1 to agent A v2 requires manual effort until versioning lands. Accepted.

## 5. Implementation Notes

This ADR is deliberately decision-only. Schema, routes, DTOs, controllers, UI wireframes, and e2e-test shape are left to the two feature specs:

* **Spec 1 — Tester experience** will cover: campaign CRUD (workspace admin), tester invitation flow, tester agent UI with post-session feedback capture, predefined-question configuration, and will include the shared foundation (entities, memberships, campaign lifecycle) as a prerequisite section so it is shippable on its own.
* **Spec 2 — Reviewer experience** will cover: reviewer invitation flow, session browser within a campaign, blind-review UI, reviewer feedback capture, and campaign-level aggregated report.

Both specs will reference this ADR for the "why" and restrict themselves to the "how."

Entities expected (names to be finalized in specs):

* `ReviewCampaign` — campaign metadata, agent FK, lifecycle state, three predefined-question configs (tester per-session, tester end-of-phase, reviewer).
* `ReviewCampaignMembership` — user × campaign × role (`tester | reviewer`).
* `TesterSessionFeedback` — 1:1 with an agent session (polymorphic over `conversation | extraction | form` via `base-agent-sessions`), authored by the session's tester: overall stars, comment, per-session question answers.
* `TesterCampaignSurvey` — 1:1 per `(tester, campaign)`, submitted once at end of participation: overall stars, comment, end-of-phase question answers (see §2.11).
* `ReviewerSessionReview` — N:1 with an agent session, unique per `(session, reviewer)`: overall stars, comment, reviewer-question answers.

Per the project CLAUDE.md, DTOs for this domain will be consolidated in `packages/@caseai-connect/api-contracts/src/review-campaigns/review-campaigns.dto.ts`, and routes in `review-campaigns.routes.ts`. The NestJS module will live at `apps/api/src/domains/review-campaigns/`.

Completion gates (per CLAUDE.md): `npm run biome:check`, `npm run typecheck`, `npm run test` must pass for any PR derived from this ADR.