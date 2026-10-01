# Feature Specification: Review Campaigns — Reviewer Experience (v1)

> **Companion documents:** [ADR 0008 — Conversational Agent Human Evaluation Model](../adr/0008-agent-human-evaluation-model.md) for all load-bearing decisions. [Review Campaigns — Tester Experience (v1)](./review-campaigns-tester-v1.md) for the Level-1 flow and the foundation this spec builds on.

> **Superseded for invitations** by [ADR 0022](../adr/0022-in-app-invitations.md): people are invited by email and accept the invitation in the app, with no invitation email. The Auth0 parts below are historical.

## Overview

Once a campaign is active and testers are generating sessions, invited **reviewers** browse those sessions, read each transcript blindly (without seeing the tester's score or comment), and submit their own 5-star rating + comment + answers to reviewer-configured questions. The campaign then exposes an aggregated report showing tester and reviewer signal side by side.

This spec depends on the foundation delivered by the tester spec (entities, memberships, lifecycle, invitation flow, reviewer questions already persisted on `ReviewCampaign`).

---

## Scope (v1)

### In Scope

- `ReviewerSessionReview` entity and migrations.
- Reviewer invitation flow (reuses the infrastructure from the tester spec — `ReviewCampaignMembership` role `reviewer`, same Auth0 invitation machinery).
- Reviewer UI: landing in a campaign, browsing all sessions, blind-reviewing a session, updating own reviews.
- **Blind review enforcement** both at the API (the reviewer-facing session endpoint strips tester opinion fields until the reviewer has submitted) and the UI (tester rating/comment hidden until submit).
- **Multiple reviews per session** allowed; one review per (session, reviewer).
- Campaign-level **aggregate report** view showing tester signal + reviewer signal + predefined-question distributions.
- Export of the report as CSV.

### Out of Scope (v1)

- Reviewer assignment ("user X must review these N sessions") — self-serve browsing only (ADR §2.6).
- Mandatory coverage targets / sampling rules.
- Inter-rater agreement metrics / consensus algorithms.
- Weighted scoring, outlier filtering.
- Cross-campaign comparison.
- Reopening closed campaigns.

---

## Core Product Decisions

All load-bearing decisions in ADR 0008. Restated where implementers need them:

1. **Blind review is a hard rule.** The reviewer must not see the tester's `overall_rating`, `comment`, or per-session free-text answers until the reviewer has submitted a review for that session. Single-choice and rating answers on the *factual* predefined tester questions (if any — campaign-owner decides) remain visible, since they describe what happened in the session, not the tester's opinion. See §5 for the exact redaction rule.
2. **Self-serve browsing.** No assignments. Reviewer sees every session in the campaign and picks.
3. **Many reviews per session, one per reviewer.** Enforced via unique constraint `(session_id, reviewer_user_id)`. Reviewer can edit their own review until campaign closes.
4. **No reconciliation.** If two reviewers disagree, both reviews are stored and surfaced independently in the report.
5. **Report is derived.** No materialized aggregate table — computed on read. First pass is un-optimized; optimize only if latency becomes a problem.
6. **CSV export is read-only snapshot.** No scheduled exports, no webhooks.

---

## Data Model

### New Entity

#### `ReviewerSessionReview`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `campaign_id` | uuid (FK → `review_campaign`) | Denormalized for aggregation. |
| `session_id` | uuid | Polymorphic — `session_type` disambiguates (same pattern as `TesterSessionFeedback`). |
| `session_type` | varchar | `conversation \| extraction \| form`. |
| `reviewer_user_id` | uuid (FK → `user`) | |
| `overall_rating` | smallint | 1–5. |
| `comment` | text (nullable) | |
| `answers` | jsonb | Array of `{questionId, value}` matching `review_campaign.reviewer_questions`. |
| `submitted_at` | timestamptz | Initial submission time; stays set across edits (distinguishes the "blind-lifted" moment). |
| `created_at`, `updated_at` | timestamptz | |

Unique: `(session_id, reviewer_user_id)`.

No migration touches existing tables — the reviewer flow is purely additive on top of the foundation.

---

## Authorization

Per ADR 0004:

- **Browse sessions in campaign / read single session / submit review / update own review:** caller must have an accepted `ReviewCampaignMembership` with role `reviewer` on the campaign, and the campaign must be `active`.
- **Read aggregate report:** workspace admin on the campaign's workspace, or accepted reviewer on the campaign (reviewers get visibility into the aggregate they contribute to).
- **Export CSV:** same as read aggregate.
- **Read sessions they don't review (closed campaign):** reviewers lose write access when the campaign closes but keep read access to sessions and the aggregate.

A user with both `tester` and `reviewer` roles on the same campaign is **prevented from reviewing their own sessions** (API enforces `session.tester_user_id !== reviewer_user_id`, 403 otherwise).

---

## API

All routes use `defineRoute` in `packages/@caseai-connect/api-contracts/src/review-campaigns/review-campaigns.routes.ts` (the same file introduced by the tester spec, extended here).

### Reviewer routes

| Method | Path | Purpose |
|---|---|---|
| GET | `me/review-campaigns?role=reviewer` | Campaigns the caller is a reviewer of. (Extends the tester-spec's `me/review-campaigns` with a role filter.) |
| GET | `review-campaigns/:campaignId/sessions` | List sessions in the campaign with summary (tester id, start time, message count, abandoned flag, reviewer count, caller-has-reviewed flag). Supports filter + pagination. |
| GET | `review-campaigns/:campaignId/sessions/:sessionId` | Session detail for review. **Redacted** per §5 until caller has submitted a review for this session. |
| POST | `review-campaigns/:campaignId/sessions/:sessionId/reviews` | Submit; 409 if reviewer already has a review for this session. After success, the redaction on subsequent GETs is lifted for this caller. |
| PATCH | `review-campaigns/:campaignId/sessions/:sessionId/reviews/:reviewId` | Update own review while campaign is active. |

### Aggregate & export

| Method | Path | Purpose |
|---|---|---|
| GET | `review-campaigns/:campaignId/report` | Aggregated report (tester + reviewer rollups + per-question distributions + session-level matrix). |
| GET | `review-campaigns/:campaignId/report.csv` | Flat CSV: one row per session with tester rating/comment, reviewer count, per-reviewer rating (wide), per-question answers. |

### Blind-Review Redaction Rule

For `GET review-campaigns/:campaignId/sessions/:sessionId` called by a reviewer who has **not yet** submitted their review for this session:

- **Included:** conversation/message transcript, session metadata (start time, agent, tester user id), tester-answered predefined questions **of type `single-choice` or `rating` that are marked as "factual" in the campaign config**, reviewer-question list to answer, other reviewers' count (but not content).
- **Excluded:** tester `overall_rating`, tester `comment`, tester free-text answers, all other reviewers' reviews.

Once the reviewer submits their review, subsequent GETs return the full payload. Editing is allowed afterward with the full payload visible.

> **Factual vs. opinion predefined questions.** The campaign config (`tester_per_session_questions`) already carries a `type` field per question (`rating | single-choice | free-text`). We extend the question shape with a boolean `isFactual` (default `false`) so campaign owners can mark e.g. "Did the agent escalate to a human?" as factual (visible during blind review) vs. "How relevant were the answers?" as opinion (hidden). This requires one additive edit to the tester-spec's `tester_per_session_questions` jsonb shape — trivial, no migration needed since it's JSONB.

### DTO Additions

`ReviewerSessionListItemDto`, `ReviewerSessionDetailDto` (with a discriminated `blind: true | false` field), `CreateReviewerReviewDto`, `UpdateReviewerReviewDto`, `CampaignReportDto` — all in `review-campaigns.dto.ts`.

---

## UI / UX

Locations: reviewer surface lives alongside the tester surface introduced in the tester spec (same route tree or sibling — implementer confirms). Admin report view lives under `apps/web/src/studio/features/review-campaigns/`.

### Reviewer landing (`/review-campaigns/:campaignId` for a reviewer)

- Campaign name + description + agent card.
- Session list: table with columns — start time, tester (first name / masked id per privacy norm — implementer confirms), message count, reviewer count, my-review status (none / drafted / submitted), abandoned flag.
- Filters: "not yet reviewed by me", "by any reviewer", "abandoned only".
- Click a row → session review page.

### Session review page

- **Left pane:** transcript (read-only), session metadata, factual tester answers (if any).
- **Right pane (blind mode):** reviewer rating stars + comment + reviewer questions. Submit button. A non-intrusive banner reads "Tester rating is hidden until you submit your review."
- **Right pane (post-submit):** submitted review (editable), plus the previously-hidden tester opinion fields revealed in a collapsible "Tester feedback" section. Other reviewers' reviews appear in a separate "Other reviewers" section (read-only).

### Aggregate report view

Accessible from the campaign editor/detail page (admin) and a "Report" link (reviewers).

- **Headline cards:** N sessions, N tester feedbacks, N reviewer reviews, mean tester rating (per-session), mean reviewer rating, mean tester end-of-phase rating/NPS, participant count.
- **Question distributions:** bar charts per predefined question (three panels: tester per-session, tester end-of-phase, reviewer).
- **Session matrix:** table — one row per session with tester rating, list of reviewer ratings (with mean + spread), quick access to the session.
- **Export button** → CSV.

Copy and labels are localized.

### Redux wiring

New features per `apps/web/CLAUDE.md`: `review-campaign-reviewing` (reviewer slice), `review-campaign-reports` (admin slice). Standard SPI + models + thunks + selectors + services registration.

---

## Testing

### API

- **Auth spec** extends the tester spec's `auth.spec.ts` with reviewer-side routes: no-token, non-member, wrong-role, blind-redaction enforcement.
- **E2E functional specs:** list-sessions, get-session-blind, get-session-after-submit, submit-review, update-review, prevent-self-review, get-report, get-report-csv.
- **Service spec:** `reviewer-reviews.service.spec.ts`, `campaign-reports.service.spec.ts`.
- **Blind-redaction test** must cover all three tester session types (conversation, extraction, form).
- Fishery factory: `reviewerSessionReviewFactory` — new.

### Web

- Component tests + Storybook for: session list, session review page (blind and post-submit), report view.
- Redux thunk tests for new slices.
- **UI blind-enforcement test:** snapshot/assert that the reviewer page in blind mode contains no element with the tester's rating or comment fields.

### Completion Gates

`npm run biome:check`, `npm run typecheck`, `npm run test` — exit 0.

---

## Open Questions

1. **Tester identity disclosure to reviewers.** Should reviewers see the tester's name/email, only an initial + last-initial, or an opaque ID? Trade-off: more identifying info helps reviewers contextualize but reduces tester candor. Proposal: opaque ID in v1, revisit based on reviewer feedback.
2. **Report pagination / large campaigns.** At what size does the un-optimized report endpoint become slow? Proposal: ship un-paginated for v1 with a soft limit (e.g. 500 sessions) and a warning; add pagination + server-side aggregation if real campaigns exceed it.
3. **Review draft state.** Should partially-written reviews auto-save as a draft? Proposal: **no** in v1 — keeping blind-lift atomic at submit is simpler and drafts aren't critical for a short review.
4. **`isFactual` UI for campaign owners.** The admin question editor (tester spec §UI) needs a new "visible to reviewers during blind review" toggle per tester per-session question. Minor editor addition; flag it here so the tester-spec implementation includes the toggle from the start.

---

## Milestones

1. **`ReviewerSessionReview` entity + migration.**
2. **Reviewer API** — list sessions, get session with blind redaction, submit/update review.
3. **Reviewer UI** — landing, session review page (blind + post-submit), wiring into the invite-accept redirect.
4. **Aggregate report API** — campaign-scoped rollups + question distributions + session matrix.
5. **Report UI** — the aggregate view accessible to reviewers and workspace admins.
6. **CSV export.**
7. **`isFactual` toggle** wired into the admin question editor from the tester spec.

Milestones 2–3 and 4–5 can proceed in parallel once 1 is merged. Milestone 7 is small and should land alongside milestone 2 for consistency with the blind-redaction rule.
