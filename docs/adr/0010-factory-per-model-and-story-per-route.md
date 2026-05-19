# ADR 0010: One Factory Per Model, One Story Per Route

* **Status**: Accepted
* **Date**: 2026-05-15
* **Deciders**: Alexis
* **Scope**: Frontend `apps/web` — factories under `features/*/*.factory.ts`, route stories under `stories/routes/`.

---

## 1. Context and Problem Statement

Two recurring failures have made frontend work slower than it should be:

1. **Models drift from fixtures.** When `*.models.ts` gains a field, fixtures hand-rolled inside stories, tests, or seed helpers don't get updated. The compiler is happy (the literals satisfy the type), but stories silently miss the new field and renderers either show stale data or crash at runtime when the field is non-nullable downstream.
2. **Routes break invisibly.** A new route entry in `StudioRoutes.tsx` / `TesterRoutes.tsx` / etc. can ship without any Storybook coverage of its route wrappers (`useMount`, `AsyncRoute`, `RestrictedFeature` gates, `useSetCurrentIds` ordering — see [ADR 0009](0009-subroute-data-loading.md)). Regressions in route plumbing are caught only when a user hits the URL.

The existing pattern of building factories and stories opportunistically has produced an inconsistent floor: some features (`agents`, `me`, `projects`) have factories and route stories, others (`agent-message-feedback`, `project-memberships`, several eval/tester features) don't.

## 2. Decision

Adopt two paired rules for `apps/web`:

### Rule 1 — One factory per model

Every `features/{domain}/{domain}.models.ts` (or other `*.models.ts`) MUST have a sibling `*.factory.ts` file using `fishery`'s `Factory.define`, in the same commit.

- File naming: match the surrounding siblings (`agents.models.ts` → `agent.factory.ts`; `documents.models.ts` → `documents.factory.ts`). Mixed singular/plural is tolerated — what matters is the 1:1 mapping.
- Required transient params (parent scope: `project`, `organization`, etc.) MUST `throw` when missing rather than silently default. A missing scope at fixture-build time always indicates a story bug.
- Every model field MUST be defaulted via `params.X ?? <faker default>`. Use neutral samples — `faker.lorem.*`, `faker.commerce.productName()`, never a vertical-specific name unless the user explicitly asks.

### Rule 2 — One story per route

Every entry in a `{scope}/routes/{Scope}Routes.tsx` registry that renders UI MUST have a matching story in `apps/web/src/stories/routes/{scope}/{RouteName}.stories.tsx`, in the same commit.

- The story MUST mount the **real route tree** via `createMemoryRouter([{scope}Routes], { initialEntries: [path] })`, not just the leaf component. This is what catches `useMount`/`AsyncRoute`/`RestrictedFeature` regressions.
- The story MUST seed Redux through `buildMockStore` + `mergeSeeds(seed.X(...), ...)` using the feature factories — never inline literal fixtures.
- The story MUST expose `argTypes` toggles for every data dependency the route reads, so the empty AND populated states are both reachable from the controls panel.
- If the route is gated by `<RestrictedFeature feature="X">`, the seeded project MUST set `featureFlags: ["X"]`.
- Pure redirects and alias routes are exempt.

### Rule 3 — Slice shape lives in `seed.ts`

When a new slice is introduced, a matching `seed.{scope}.{slice}()` helper MUST be added to [seed.ts](../../apps/web/src/stories/seed.ts). Stories never reach into raw slice shape — that knowledge stays in one place.

## 3. Concrete Reference

The evaluations slice (added 2026-05) is the canonical reference:

```
apps/web/src/studio/features/evaluations/
  evaluations.models.ts      ── domain model
  evaluations.factory.ts     ── 1:1 sibling factory (this ADR)

apps/web/src/studio/features/evaluation-reports/
  evaluation-reports.models.ts
  evaluation-reports.factory.ts  ── transient params: { evaluation, agent }

apps/web/src/stories/seed.ts
  seed.studio.evaluations(...)         ── slice-shape helper
  seed.studio.evaluationReports(...)   ── slice-shape helper

apps/web/src/stories/routes/studio/EvaluationRoute.stories.tsx
  ── mounts studioRoutes via createMemoryRouter
  ── seeds project with featureFlags: ["evaluation"]
  ── argTypes: { role, withEvaluations, withEvaluationReports }
```

## 4. Why Not Alternatives?

### Hand-rolled fixtures inside each story

The status quo. Cheap upfront, but every model change is a silent fixture-rot bomb across N stories. Factories centralise the defaults so the cost of a model change is O(1).

### Leaf-component stories only (no route mount)

Skips the route wrappers — the most failure-prone code in the app (per [ADR 0009](0009-subroute-data-loading.md)). Leaf stories are fine for the underlying presentational components, but the route-level story is what proves the wiring works.

### Lint rule instead of a CLAUDE.md + skill

A lint rule that fails CI when a model lacks a factory is the strongest version of this rule, but it requires us to first backfill the dozens of existing models that have no factory. Until that backfill happens, the rule stays as: documented in CLAUDE.md, audited on demand via the `check-factories-and-stories` skill, and enforced for **new** models/routes by the author and reviewer.

## 5. Consequences

- **Positive**: model changes are caught at the factory layer instead of leaking into every story. Route stories double as smoke tests for route wrappers. New contributors have a working pattern to copy.
- **Negative**: small upfront cost per new model/route (~30 lines of factory + ~70 lines of story). Acceptable — these files are mechanical.
- **Migration**: existing models/routes without factories/stories are NOT retroactively required to add them. The rule applies going forward; backfill is opportunistic when touching the area.
