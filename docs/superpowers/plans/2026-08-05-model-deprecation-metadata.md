# Model deprecation metadata and migration banner — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mark `gemini-2.5-flash` and `gemini-2.5-pro` as deprecated across the product, warn on
every agent still running them, and default new agents to `gemini-3.5-flash-lite` — driven by a
data-only catalog so future deprecations need no new code.

**Architecture:** A single exhaustive `AgentModelMetadataMap` in `api-contracts` carries an
optional `deprecation` object per model. One read helper (`getAgentModelDeprecation`) feeds both
the `(deprecated)` dropdown suffix and a self-suppressing `DeprecatedModelBanner` component. The
`vertex-3` feature flag is removed so the replacement models are selectable everywhere.

**Tech Stack:** TypeScript, Zod (api-contracts), React + Redux + react-hook-form (web),
react-i18next, `@caseai-connect/ui` shadcn components, lucide-react icons, vitest, Storybook,
Biome.

**Spec:** `docs/superpowers/specs/2026-08-05-model-deprecation-metadata-design.md`

## Global Constraints

- Deprecation date for both 2.5 models: `"2026-09-30"` (ISO `YYYY-MM-DD` string, not a `Date`).
- Replacements: `gemini-2.5-flash` → `AgentModel.Gemini35FlashLite`; `gemini-2.5-pro` →
  `AgentModel.Gemini35Flash`.
- Default model for new agents and eval judge runs: `AgentModel.Gemini35FlashLite`.
- The banner is **non-dismissible**. No dismiss button, no localStorage.
- Deprecated models stay **selectable** in every model dropdown.
- No `any`, `as any`, `@ts-ignore`, or `@ts-expect-error` (apps/web/CLAUDE.md).
- No single-letter loop variables — `models.map((model) => …)`, never `(m) =>` (root CLAUDE.md).
- Sample data stays domain-neutral: generic agent names, no vertical-specific terms
  (root CLAUDE.md).
- Every user-visible string is an i18n key with both `en` and `fr` values. Reuse
  `actions:` / `status:` shared keys where a generic verb already exists (apps/web/CLAUDE.md).
- Run from the worktree root: `/home/alexis_bayesimpact_org/bayes-platform/.claude/worktrees/550-migration-plan-gemini`.
- Do NOT run `npm install` — dependencies are already installed via `npm ci`.
- Completion gates (root CLAUDE.md): `npm run biome:check` and `npm run typecheck` must exit 0.

### Verified baseline

Measured in this worktree before any of this plan's changes, so a deviation means you broke
something:

- `npm run typecheck` — 6 tasks, all successful.
- `npm run test --workspace=@caseai-connect/web` — 6 files, 42 tests, all passing.
- `npm run test --workspace=@caseai-connect/api -- src/domains/evaluations/conversation/runs` —
  14 suites, 116 tests, all passing.

The worktree's gitignored config (`apps/api/.env`, `apps/api/.env.test`, `apps/web/.env`,
`infra/database/.env`) has already been copied in. Without `apps/api/.env.test`, every API e2e
spec fails with `DATABASE_URL not found in environment` — if you see that, the config is missing,
not the code.

### Verified command forms

These were checked in this worktree. The intuitive variants are broken — use exactly these:

| Purpose | Command |
| --- | --- |
| One web spec | `npm run test --workspace=@caseai-connect/web -- <path-relative-to-apps/web>` |
| All web specs | `npm run test --workspace=@caseai-connect/web` |
| API specs by path | `npm run test --workspace=@caseai-connect/api -- <path-relative-to-apps/api>` |
| Whole API suite | `npx turbo test --filter=@caseai-connect/api` |
| Storybook dev | `npm run storybook --workspace=@caseai-connect/web -- -p 6007 --no-open` |
| Storybook build | `npm run build-storybook --workspace=@caseai-connect/web` |

Known traps:

- `npx vitest run <path> --root apps/web` resolves the root twice (`apps/web/apps/web`) and finds
  no test files. Always go through the workspace script.
- `npx turbo test --filter=api` fails — turbo needs the full package name
  (`@caseai-connect/api`), not the directory name, despite what root `CLAUDE.md` says.
- `storybook` and `build-storybook` are npm scripts in `apps/web` only, not turbo tasks.
- Never use a bare `npx jest` for API specs: the workspace script supplies the required
  `node --experimental-vm-modules` and `--runInBand` flags.
- API specs read `apps/api/.env.test` and hit the **shared** test database. Do not run them while
  another checkout is running its API suite.

---

## File Structure

**Created:**

| File | Responsibility |
| --- | --- |
| `apps/web/src/common/features/agents/agent-model.helpers.ts` | Which models a project may pick, and how each is labelled. |
| `apps/web/src/common/features/agents/agent-model.helpers.spec.ts` | Catalog invariants, option gating, label formatting. |
| `apps/web/src/common/features/agents/components/DeprecatedModelBanner.tsx` | Self-suppressing deprecation alert for one model. |

**Modified:**

| File | Change |
| --- | --- |
| `packages/api-contracts/src/agents/agents.dto.ts` | Add the metadata catalog, `DEFAULT_AGENT_MODEL`, `getAgentModelDeprecation`. |
| `packages/api-contracts/src/feature-flags/feature-flags.dto.ts` | Remove the `vertex-3` flag. |
| `apps/web/src/studio/features/agents/components/AgentModelTab.tsx` | Use the shared option builder, label options. |
| `apps/web/src/eval/features/evaluation-conversation-runs/components/RunEvaluationConversationDialog.tsx` | Same, plus the new judge default. |
| `apps/web/src/studio/routes/StudioAgentRoute.tsx` | Mount the banner. |
| `apps/web/src/studio/features/agents/components/agent-form.shared.ts` | New-agent default model. |
| `apps/web/src/common/features/agents/agent.factory.ts` | Factory default model. |
| `apps/web/src/eval/features/evaluation-conversation-runs/evaluation-conversation-runs.factory.ts` | Judge default. |
| `apps/api/src/domains/evaluations/conversation/runs/evaluation-conversation-run.factory.ts` | Judge default. |
| `apps/api/src/domains/evaluations/conversation/runs/evaluation-conversation-run-grader-llm.service.ts` | Stale doc comment. |
| `apps/web/src/common/features/agents/locales/agent.en.json` / `agent.fr.json` | New `model.*` keys. |
| `apps/web/src/stories/routes/studio/agent/AgentRoute.stories.tsx` | `withDeprecatedModel` toggle. |
| `apps/web/src/stories/routes/studio/AgentEditorRoute.stories.tsx` | `withDeprecatedModel` toggle. |

---

## Task 1: Deprecation catalog and model-option helpers

**Files:**
- Modify: `packages/api-contracts/src/agents/agents.dto.ts` (insert after
  `AgentModelToAgentProvider`, which ends at line 41)
- Create: `apps/web/src/common/features/agents/agent-model.helpers.ts`
- Test: `apps/web/src/common/features/agents/agent-model.helpers.spec.ts`

**Interfaces:**
- Consumes: `AgentModel`, `AgentProvider` and `AgentModelToAgentProvider`, already exported from
  `packages/api-contracts/src/agents/agents.dto.ts`; the `HasFeature` type already exported from
  `apps/web/src/common/hooks/use-feature-flags.ts` (`(feature: FeatureFlagKey) => boolean`).
- Produces from api-contracts, all re-exported automatically by
  `packages/api-contracts/src/index.ts` via `export * from "./agents/agents.dto"`:
  - `type AgentModelDeprecation = { deprecatedOn: string; recommendedReplacement: AgentModel }`
  - `type AgentModelMetadata = { deprecation?: AgentModelDeprecation }`
  - `const AgentModelMetadataMap: Record<AgentModel, AgentModelMetadata>`
  - `const DEFAULT_AGENT_MODEL: AgentModel` (value `AgentModel.Gemini35FlashLite`)
  - `function getAgentModelDeprecation(model: AgentModel): AgentModelDeprecation | undefined`
- Produces from `@/common/features/agents/agent-model.helpers`:
  - `function buildAgentModelOptions(hasFeature: HasFeature): AgentModel[]`
  - `function formatAgentModelLabel(model: AgentModel, deprecatedSuffix: string): string`

**Why `buildAgentModelOptions` is shared:** `AgentModelTab` and `RunEvaluationConversationDialog`
each carry a near-identical copy of this provider-gating logic today, the second with a comment
reading "Mirrors AgentModelTab.extractModelList". Task 2 replaces both with calls to this one
function, so the gating rules get unit tests and the next model change touches one place.

**Why it returns `AgentModel[]`, not `[string, AgentModel][]`:** the existing tuple's first
element is the enum key, used only as a React `key`. Model ids are already unique, so
`key={model}` serves and the tuple is dead weight.

**Why `formatAgentModelLabel` takes a string, not `t`:** it stays a pure function with no
react-i18next dependency, so the spec tests it without stubbing `TFunction` (which would need a
cast, banned by apps/web/CLAUDE.md). Callers pass `t("agent:model.deprecatedSuffix")`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/common/features/agents/agent-model.helpers.spec.ts`:

```ts
import {
  AgentModel,
  AgentModelMetadataMap,
  DEFAULT_AGENT_MODEL,
  getAgentModelDeprecation,
} from "@caseai-connect/api-contracts"
import { describe, expect, it } from "vitest"
import { formatAgentModelLabel } from "./agent-model.helpers"

describe("AgentModelMetadataMap", () => {
  it("has an entry for every model", () => {
    const missing = Object.values(AgentModel).filter((model) => !AgentModelMetadataMap[model])

    expect(missing).toEqual([])
  })

  it("never recommends a replacement that is itself deprecated", () => {
    const selfDefeating = Object.values(AgentModel).filter((model) => {
      const replacement = getAgentModelDeprecation(model)?.recommendedReplacement
      return !!replacement && !!getAgentModelDeprecation(replacement)
    })

    expect(selfDefeating).toEqual([])
  })

  it("uses ISO dates for every deprecation", () => {
    const badDates = Object.values(AgentModel)
      .map((model) => getAgentModelDeprecation(model)?.deprecatedOn)
      .filter((date) => date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(date))

    expect(badDates).toEqual([])
  })

  it("marks the gemini 2.5 models as deprecated on 2026-09-30", () => {
    expect(getAgentModelDeprecation(AgentModel.Gemini25Flash)).toEqual({
      deprecatedOn: "2026-09-30",
      recommendedReplacement: AgentModel.Gemini35FlashLite,
    })
    expect(getAgentModelDeprecation(AgentModel.Gemini25Pro)).toEqual({
      deprecatedOn: "2026-09-30",
      recommendedReplacement: AgentModel.Gemini35Flash,
    })
  })

  it("does not deprecate the default model", () => {
    expect(getAgentModelDeprecation(DEFAULT_AGENT_MODEL)).toBeUndefined()
  })
})

describe("formatAgentModelLabel", () => {
  it("appends the suffix to a deprecated model", () => {
    expect(formatAgentModelLabel(AgentModel.Gemini25Flash, "(deprecated)")).toBe(
      "gemini-2.5-flash (deprecated)",
    )
  })

  it("leaves a supported model untouched", () => {
    expect(formatAgentModelLabel(AgentModel.Gemini35FlashLite, "(deprecated)")).toBe(
      "gemini-3.5-flash-lite",
    )
  })
})

describe("buildAgentModelOptions", () => {
  const noFlags: HasFeature = () => false

  it("always offers the vertex and vertex 3 models", () => {
    expect(buildAgentModelOptions(noFlags)).toEqual([
      AgentModel.Gemini25Flash,
      AgentModel.Gemini25Pro,
      AgentModel.Gemini31FlashLite,
      AgentModel.Gemini35FlashLite,
      AgentModel.Gemini35Flash,
      AgentModel.Gemini36Flash,
    ])
  })

  it("keeps the recommended replacements available with no flags enabled", () => {
    const options = buildAgentModelOptions(noFlags)
    const replacements = Object.values(AgentModel)
      .map((model) => getAgentModelDeprecation(model)?.recommendedReplacement)
      .filter((replacement) => replacement !== undefined)

    for (const replacement of replacements) {
      expect(options).toContain(replacement)
    }
  })

  it("adds a flagged provider's models only when its flag is on", () => {
    const options = buildAgentModelOptions((feature) => feature === "mistral")

    expect(options).toContain(AgentModel.MistralSmall31_24B)
    expect(options).not.toContain(AgentModel.Gemma4_26B)
    expect(options).not.toContain(AgentModel.MedGemma10_27B)
  })

  it("never offers the mock model", () => {
    expect(buildAgentModelOptions(() => true)).not.toContain(AgentModel._Mock)
  })
})
```

Extend the import block at the top of the spec so it also pulls
`buildAgentModelOptions` from `./agent-model.helpers` and the `HasFeature` type:

```ts
import type { HasFeature } from "@/common/hooks/use-feature-flags"
import { buildAgentModelOptions, formatAgentModelLabel } from "./agent-model.helpers"
```

The first `buildAgentModelOptions` test asserts an exact array, which pins the display order as
well as the membership — enum declaration order, so the un-deprecated replacements sit directly
below the models they replace.

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test --workspace=@caseai-connect/web -- src/common/features/agents/agent-model.helpers.spec.ts
```

Expected: FAIL — module `./agent-model.helpers` cannot be resolved, and
`AgentModelMetadataMap` / `DEFAULT_AGENT_MODEL` / `getAgentModelDeprecation` are not exported
from `@caseai-connect/api-contracts`.

- [ ] **Step 3: Add the catalog to api-contracts**

In `packages/api-contracts/src/agents/agents.dto.ts`, insert immediately after the closing brace
of `AgentModelToAgentProvider` (line 41) and before `export enum AgentLocale`:

```ts
export type AgentModelDeprecation = {
  /** ISO date (YYYY-MM-DD) on which the provider retires the model. */
  deprecatedOn: string
  recommendedReplacement: AgentModel
}

/**
 * Per-model catalog. The fields are optional, but the map is exhaustive on purpose: adding a
 * model to `AgentModel` fails to compile until it has an entry here, so a new model can never
 * silently ship without deprecation metadata.
 *
 * Grouping `deprecatedOn` and `recommendedReplacement` in one object makes "deprecated implies a
 * replacement" a type invariant — no consumer has to render a dead end.
 */
export type AgentModelMetadata = {
  deprecation?: AgentModelDeprecation
}

export const AgentModelMetadataMap: Record<AgentModel, AgentModelMetadata> = {
  [AgentModel.Gemini25Flash]: {
    deprecation: {
      deprecatedOn: "2026-09-30",
      recommendedReplacement: AgentModel.Gemini35FlashLite,
    },
  },
  [AgentModel.Gemini25Pro]: {
    deprecation: {
      deprecatedOn: "2026-09-30",
      recommendedReplacement: AgentModel.Gemini35Flash,
    },
  },
  [AgentModel.Gemini31FlashLite]: {},
  [AgentModel.Gemini35FlashLite]: {},
  [AgentModel.Gemini35Flash]: {},
  [AgentModel.Gemini36Flash]: {},
  [AgentModel.MedGemma10_27B]: {},
  [AgentModel.Gemma4_26B]: {},
  [AgentModel.MistralSmall31_24B]: {},
  [AgentModel._Mock]: {},
}

/** Model every newly created agent and eval judge run starts on. */
export const DEFAULT_AGENT_MODEL = AgentModel.Gemini35FlashLite

/**
 * Single read path for deprecation state. Returns `undefined` for a supported model, so callers
 * can branch on presence rather than on a model allow-list — a future deprecation is one entry
 * in `AgentModelMetadataMap` and no code change here or downstream.
 */
export function getAgentModelDeprecation(model: AgentModel): AgentModelDeprecation | undefined {
  return AgentModelMetadataMap[model].deprecation
}
```

- [ ] **Step 4: Create the helpers**

Create `apps/web/src/common/features/agents/agent-model.helpers.ts`:

```ts
import {
  AgentModel,
  AgentModelToAgentProvider,
  AgentProvider,
  getAgentModelDeprecation,
} from "@caseai-connect/api-contracts"
import type { HasFeature } from "@/common/hooks/use-feature-flags"

/**
 * Models a project may choose from, in enum declaration order.
 *
 * Single source of truth for provider gating: `AgentModelTab` and the eval judge picker both
 * call this, so a new provider or a new gate is one change here.
 */
export function buildAgentModelOptions(hasFeature: HasFeature): AgentModel[] {
  const providers: AgentProvider[] = [
    // Vertex3 is never gated: it holds the recommended replacements for the deprecated Vertex
    // models, so hiding it would leave a project unable to migrate off them.
    AgentProvider.Vertex,
    AgentProvider.Vertex3,
  ]
  if (hasFeature("medgemma")) providers.push(AgentProvider.MedGemma)
  if (hasFeature("gemma")) providers.push(AgentProvider.Gemma)
  if (hasFeature("mistral")) providers.push(AgentProvider.Mistral)

  // AgentModel._Mock drops out naturally — its provider is never in the list.
  return Object.values(AgentModel).filter((model) =>
    providers.includes(AgentModelToAgentProvider[model]),
  )
}

/**
 * Option label for a model in a select. Pass the already-translated suffix
 * (`t("agent:model.deprecatedSuffix")`) so this stays a pure function.
 */
export function formatAgentModelLabel(model: AgentModel, deprecatedSuffix: string): string {
  return getAgentModelDeprecation(model) ? `${model} ${deprecatedSuffix}` : model
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npm run test --workspace=@caseai-connect/web -- src/common/features/agents/agent-model.helpers.spec.ts
```

Expected: PASS — 12 tests.

- [ ] **Step 6: Typecheck and lint**

```bash
npm run typecheck && npm run biome:check
```

Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add packages/api-contracts/src/agents/agents.dto.ts \
        apps/web/src/common/features/agents/agent-model.helpers.ts \
        apps/web/src/common/features/agents/agent-model.helpers.spec.ts
git commit -m "feat(agents): add per-model deprecation metadata catalog"
```

Note for the reviewer: `buildAgentModelOptions` is unused until Task 2 replaces both dropdowns'
private copies with it. That is deliberate sequencing, not dead code.

---

## Task 2: Label deprecated models and remove the `vertex-3` flag

Ungating Vertex3 models and deleting the flag are one change: removing the two `hasFeature`
calls is exactly what makes the flag dead, so they ship and get reviewed together.

**Files:**
- Modify: `packages/api-contracts/src/feature-flags/feature-flags.dto.ts:32-35` (the `vertex-3`
  `featureFlag({…})` entry)
- Modify: `apps/web/src/studio/features/agents/components/AgentModelTab.tsx` — delete
  `extractModelList` (lines 37-68) and rewrite the `SelectItem` map (lines 106-110)
- Modify: `apps/web/src/eval/features/evaluation-conversation-runs/components/RunEvaluationConversationDialog.tsx`
  — delete `extractJudgeModelList` (lines 78-95), rewrite `JudgeModelField`'s `models` prop type
  and `SelectItem` map (lines 398-425)
- Modify: `apps/web/src/common/features/agents/locales/agent.en.json`,
  `apps/web/src/common/features/agents/locales/agent.fr.json`

**Interfaces:**
- Consumes: `buildAgentModelOptions` and `formatAgentModelLabel` from
  `@/common/features/agents/agent-model.helpers` (Task 1). `buildAgentModelOptions` returns
  `AgentModel[]`, replacing the old `[string, AgentModel][]` tuples.
- Produces: i18n key `agent:model.deprecatedSuffix`. Task 3 adds sibling keys under the same
  `agent.model` object, so create `model` as an object, not a flat key.

Both components lose their private list builders entirely — that duplicated provider-gating logic
now lives once in `agent-model.helpers.ts` with unit tests behind it.

- [ ] **Step 1: Add the i18n suffix key**

In `apps/web/src/common/features/agents/locales/agent.en.json`, add a `model` object inside the
top-level `agent` object (a sibling of the existing `props`, `tabs`, `playground` keys — note
`props.model` already exists and is a different, unrelated key for the field label):

```json
  "model": {
    "deprecatedSuffix": "(deprecated)"
  }
```

In `apps/web/src/common/features/agents/locales/agent.fr.json`, the same position:

```json
  "model": {
    "deprecatedSuffix": "(déprécié)"
  }
```

- [ ] **Step 2: Switch `AgentModelTab.tsx` to the shared helper**

Delete the whole `extractModelList` function (lines 37-68). Replace the `models` assignment
inside the component (line 75) with:

```tsx
  const models = buildAgentModelOptions(hasFeature)
```

Replace the `SelectItem` map (lines 106-110) with:

```tsx
                    {models.map((model) => (
                      <SelectItem key={model} value={model}>
                        {formatAgentModelLabel(model, t("agent:model.deprecatedSuffix"))}
                      </SelectItem>
                    ))}
```

Add the import (Biome sorts imports; place it with the other `@/common/features` imports):

```tsx
import {
  buildAgentModelOptions,
  formatAgentModelLabel,
} from "@/common/features/agents/agent-model.helpers"
```

Then prune the now-unused imports from the `@caseai-connect/api-contracts` block at the top —
`AgentModel`, `AgentModelToAgentProvider` and `AgentProvider` were only used by the deleted
function. `updateAgentModelSchema` stays. Lint fails on unused imports, so this is not optional.

- [ ] **Step 3: Switch `RunEvaluationConversationDialog.tsx` to the shared helper**

Delete the explanatory comment and the whole `extractJudgeModelList` function (lines 78-95).
Replace the `judgeModels` memo (line 113) with:

```tsx
  const judgeModels = useMemo(() => buildAgentModelOptions(hasFeature), [hasFeature])
```

In the `JudgeModelField` sub-component (defined at line 398), change its `models` prop type
(line 403) from `[string, AgentModel][]` to:

```tsx
  models: AgentModel[]
```

and replace its `SelectItem` map (lines 421-425) with:

```tsx
              {models.map((model) => (
                <SelectItem key={model} value={model}>
                  {formatAgentModelLabel(model, t("agent:model.deprecatedSuffix"))}
                </SelectItem>
              ))}
```

`JudgeModelField` already calls `useTranslation()` at line 405, so `t` is in scope. Add the same
two-name import from `@/common/features/agents/agent-model.helpers`, then prune
`AgentModelToAgentProvider` and `AgentProvider` from the api-contracts import block — the deleted
function was their only consumer. `AgentModel` is still used (the `models` prop type and
`defaultRunFormValues`), so keep it.

- [ ] **Step 4: Delete the `vertex-3` feature flag**

In `packages/api-contracts/src/feature-flags/feature-flags.dto.ts`, delete this entire entry from
the `FeatureFlags` array:

```ts
  featureFlag({
    key: "vertex-3",
    description: "(tests purpose only) Access and utilize new vertex 3.x models.",
  }),
```

- [ ] **Step 5: Verify no `vertex-3` references remain**

```bash
grep -rn "vertex-3" --include=*.ts --include=*.tsx --include=*.json apps packages | grep -v node_modules
```

Expected: no output. If a story or seed still lists `"vertex-3"` in a `featureFlags` array,
remove that string too — `FeatureFlagKey` no longer accepts it and typecheck will fail.

- [ ] **Step 6: Typecheck and lint**

```bash
npm run typecheck && npm run biome:check
```

Expected: both exit 0.

- [ ] **Step 7: Verify the dropdown visually (optional)**

`storybook` is an npm script in `apps/web`, not a turbo task, and port 6006 may already be taken
by the main checkout — so run it on a spare port:

```bash
npm run storybook --workspace=@caseai-connect/web -- -p 6007 --no-open
```

Open `routes/studio/project/agent/edit → ConversationAgent`, go to the Model tab, open the
select. Expected: `gemini-2.5-flash (deprecated)` and `gemini-2.5-pro (deprecated)` appear
alongside the un-suffixed `gemini-3.1-flash-lite`, `gemini-3.5-flash-lite`, `gemini-3.5-flash`
and `gemini-3.6-flash`, with no feature flag enabled. Stop Storybook when done.

Skip this step if running unattended — Task 5 covers both states with committed stories, and the
typecheck in step 6 is the blocking gate.

- [ ] **Step 8: Commit**

```bash
git add packages/api-contracts/src/feature-flags/feature-flags.dto.ts \
        apps/web/src/studio/features/agents/components/AgentModelTab.tsx \
        apps/web/src/eval/features/evaluation-conversation-runs/components/RunEvaluationConversationDialog.tsx \
        apps/web/src/common/features/agents/locales/agent.en.json \
        apps/web/src/common/features/agents/locales/agent.fr.json
git commit -m "feat(agents): label deprecated models and ungate vertex 3 models"
```

---

## Task 3: Deprecation banner

**Files:**
- Create: `apps/web/src/common/features/agents/components/DeprecatedModelBanner.tsx`
- Modify: `apps/web/src/studio/routes/StudioAgentRoute.tsx`
- Modify: `apps/web/src/common/features/agents/locales/agent.en.json`,
  `apps/web/src/common/features/agents/locales/agent.fr.json`

**Interfaces:**
- Consumes: `getAgentModelDeprecation` from `@caseai-connect/api-contracts` (Task 1);
  `buildDate` from `@/common/utils/build-date` (existing — signature
  `buildDate(date: TimeType, formatStr?: string) => string`, defaults to
  `"dd MMMM yyyy HH:mm"` and applies the user's `date-fns` locale);
  `Alert` / `AlertTitle` / `AlertDescription` from `@caseai-connect/ui/shad/alert`.
- Produces: `function DeprecatedModelBanner({ model }: { model: AgentModel }): React.ReactNode` —
  returns `null` for a supported model. Task 5's stories rely on that self-suppression.

**Why it takes a model, not an agent:** any surface that knows a model id can mount it
unconditionally, and a future deprecation lights it up with no code change.

- [ ] **Step 1: Add the banner i18n keys**

In `apps/web/src/common/features/agents/locales/agent.en.json`, extend the `agent.model` object
added in Task 2 so it reads:

```json
  "model": {
    "deprecatedSuffix": "(deprecated)",
    "deprecation": {
      "title": "{{model}} is being retired on {{date}}",
      "description": "Update this agent to {{replacement}} and re-test it before that date. After it, runs on {{model}} will start failing."
    }
  }
```

In `apps/web/src/common/features/agents/locales/agent.fr.json`:

```json
  "model": {
    "deprecatedSuffix": "(déprécié)",
    "deprecation": {
      "title": "{{model}} sera retiré le {{date}}",
      "description": "Mettez cet agent à jour vers {{replacement}} et testez-le avant cette date. Passé ce délai, les exécutions sur {{model}} échoueront."
    }
  }
```

- [ ] **Step 2: Create the banner component**

Create `apps/web/src/common/features/agents/components/DeprecatedModelBanner.tsx`:

```tsx
import { type AgentModel, getAgentModelDeprecation } from "@caseai-connect/api-contracts"
import { Alert, AlertDescription, AlertTitle } from "@caseai-connect/ui/shad/alert"
import { TriangleAlertIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { buildDate } from "@/common/utils/build-date"

/**
 * Warns that a model is being retired and names its replacement. Renders nothing when the model
 * is supported, so callers mount it unconditionally — declaring a future deprecation in
 * `AgentModelMetadataMap` is enough to surface it here.
 *
 * Not dismissible: migrating is mandatory, not advisory.
 */
export function DeprecatedModelBanner({ model }: { model: AgentModel }) {
  const { t } = useTranslation()
  const deprecation = getAgentModelDeprecation(model)

  if (!deprecation) return null

  const interpolation = {
    model,
    replacement: deprecation.recommendedReplacement,
    // `new Date("2026-09-30")` parses as UTC midnight, which formats as 29 September in any
    // negative-offset timezone. Appending the time forces local-midnight parsing instead.
    date: buildDate(new Date(`${deprecation.deprecatedOn}T00:00:00`).getTime(), "dd MMMM yyyy"),
  }

  return (
    <Alert variant="destructive">
      <TriangleAlertIcon />
      <AlertTitle>{t("agent:model.deprecation.title", interpolation)}</AlertTitle>
      <AlertDescription>
        {t("agent:model.deprecation.description", interpolation)}
      </AlertDescription>
    </Alert>
  )
}
```

- [ ] **Step 3: Mount it in `StudioAgentRoute`**

Replace the whole of `apps/web/src/studio/routes/StudioAgentRoute.tsx` with:

```tsx
import { selectCurrentAgentData } from "@/common/features/agents/agents.selectors"
import { DeprecatedModelBanner } from "@/common/features/agents/components/DeprecatedModelBanner"
import { useAbility } from "@/common/hooks/use-ability"
import { useMount } from "@/common/hooks/use-mount"
import { useValue } from "@/common/hooks/use-value"
import { agentHistoryActions } from "@/studio/features/agents/agent-history.slice"

/**
 * Loads the agent settings history for the whole Studio agent subtree, so the playground
 * can label message and header revisions without waiting for the editor's sheet to open.
 *
 * Manager-only: the history endpoint requires the manage-agent policy, and a member who
 * cannot manage the agent sees no version indicators.
 *
 * Rendering is not gated on the history — the playground shows immediately and the
 * indicators appear once the fetch lands.
 *
 * Also hosts the deprecated-model banner. This is the single mount point for both the agent
 * view and the editor view: `StudioRoutes.agentEdit` nests under `StudioRoutes.agent`, so
 * mounting the banner in `AgentEditorRoute` as well would render it twice there. The banner is a
 * fragment sibling rather than a wrapper so the full-height layouts below are untouched.
 */
export function StudioAgentRoute({ children }: { children: React.ReactNode }) {
  const agent = useValue(selectCurrentAgentData)
  const { abilities } = useAbility()

  useMount({
    actions: agentHistoryActions,
    condition: abilities.canManageAgent({ agentId: agent.id }),
    refreshOn: [agent.id],
  })

  return (
    <>
      <div className="px-6 pt-4 empty:hidden">
        <DeprecatedModelBanner model={agent.model} />
      </div>
      {children}
    </>
  )
}
```

`empty:hidden` on the wrapper keeps the padding from leaving a gap when the banner
self-suppresses.

- [ ] **Step 4: Typecheck and lint**

```bash
npm run typecheck && npm run biome:check
```

Expected: both exit 0.

- [ ] **Step 5: Verify the banner visually (optional)**

```bash
npm run storybook --workspace=@caseai-connect/web -- -p 6007 --no-open
```

`agent.factory.ts` still defaults to `Gemini25Flash` at this point (Task 4 changes it), so every
agent story is deprecated. Open `routes/studio/project/agent → AgentConvWithSessions`. Expected:
a destructive-styled alert with a warning triangle reading "gemini-2.5-flash is being retired on
30 September 2026", above the session list. Open
`routes/studio/project/agent/edit → ConversationAgent`. Expected: the same banner appears exactly
once, above the editor header. Stop Storybook when done.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/common/features/agents/components/DeprecatedModelBanner.tsx \
        apps/web/src/studio/routes/StudioAgentRoute.tsx \
        apps/web/src/common/features/agents/locales/agent.en.json \
        apps/web/src/common/features/agents/locales/agent.fr.json
git commit -m "feat(agents): warn when an agent runs a deprecated model"
```

---

## Task 4: Default new agents and judge runs to gemini-3.5-flash-lite

**Files:**
- Modify: `apps/web/src/studio/features/agents/components/agent-form.shared.ts:35`
- Modify: `apps/web/src/common/features/agents/agent.factory.ts:76`
- Modify: `apps/web/src/eval/features/evaluation-conversation-runs/components/RunEvaluationConversationDialog.tsx:72`
- Modify: `apps/web/src/eval/features/evaluation-conversation-runs/evaluation-conversation-runs.factory.ts:68`
- Modify: `apps/api/src/domains/evaluations/conversation/runs/evaluation-conversation-run.factory.ts:52`
- Modify: `apps/api/src/domains/evaluations/conversation/runs/evaluation-conversation-run-grader.service.ts:11`

**Interfaces:**
- Consumes: `DEFAULT_AGENT_MODEL` from `@caseai-connect/api-contracts` (Task 1).
- Produces: nothing new. Task 5 depends on `agent.factory.ts` no longer defaulting to a
  deprecated model.

**Scope note:** the eval judge default is included on purpose. It is not "a new agent", but
defaulting judge runs to a model retired in September recreates the same problem in the eval
surface. The `judge_model` **database column default** (`"gemini-2.5-flash"` in
`evaluation-conversation-run.entity.ts:55`) is deliberately left alone — `createOne` requires,
validates and always writes `judgeModel`, so that default is never exercised, and changing it
would mean a migration against the shared database for dead configuration.

- [ ] **Step 1: Change the new-agent form default**

In `apps/web/src/studio/features/agents/components/agent-form.shared.ts`, replace line 35:

```ts
    model: DEFAULT_AGENT_MODEL,
```

Then in the import block at the top, replace the `AgentModel` value import with the constant —
`AgentModel` is not otherwise used in this file:

```ts
import {
  type AgentLocale,
  type CreateAgentDto,
  DEFAULT_AGENT_MODEL,
  DocumentsRagMode,
} from "@caseai-connect/api-contracts"
```

- [ ] **Step 2: Change the web agent factory default**

In `apps/web/src/common/features/agents/agent.factory.ts`, replace line 76:

```ts
    model: params.model ?? DEFAULT_AGENT_MODEL,
```

Line 76 is the file's only reference to `AgentModel`, so replace that named import with
`DEFAULT_AGENT_MODEL` rather than adding alongside it — leaving it would fail lint as an unused
import.

- [ ] **Step 3: Change the eval judge defaults**

In `apps/web/src/eval/features/evaluation-conversation-runs/components/RunEvaluationConversationDialog.tsx`,
replace line 72 inside `defaultRunFormValues`:

```ts
  judgeModel: DEFAULT_AGENT_MODEL,
```

In `apps/web/src/eval/features/evaluation-conversation-runs/evaluation-conversation-runs.factory.ts`,
replace line 68:

```ts
      judgeModel: params.judgeModel ?? DEFAULT_AGENT_MODEL,
```

In `apps/api/src/domains/evaluations/conversation/runs/evaluation-conversation-run.factory.ts`,
replace line 52:

```ts
      judgeModel: params.judgeModel ?? DEFAULT_AGENT_MODEL,
```

Add `DEFAULT_AGENT_MODEL` to each file's `@caseai-connect/api-contracts` import, and drop
`AgentModel` from that import wherever it becomes unused.

- [ ] **Step 4: Fix the stale grader comment**~~~~

In `apps/api/src/domains/evaluations/conversation/runs/evaluation-conversation-run-grader-llm.service.ts`,
line 11 currently reads `per run (defaulting to Gemini 2.5 Flash) and passed in via
\`judgeModel\`, and`. Replace the parenthetical so it names no specific model — the default now
lives in one place and this comment should not have to track it:

```
 * per run (see DEFAULT_AGENT_MODEL for the default the UI offers) and passed in via
```

- [ ] **Step 5: Run the affected test suites**

```bash
npm run test --workspace=@caseai-connect/web
```

Expected: PASS. Web specs build agents via factories and do not assert a hard-coded model.

```bash
npm run test --workspace=@caseai-connect/api -- src/domains/evaluations/conversation/runs
```

Expected: 14 suites, 116 tests, all passing (that is the verified baseline before this change).
API specs that care about the model pass it explicitly, so the factory default change does not
reach their assertions.

Always go through `npm run test --workspace=…`, never a bare `npx jest`: the workspace script
supplies the `node --experimental-vm-modules` flag and `--runInBand` that API specs require.
These specs hit the shared test database via `apps/api/.env.test`, so do not run them
concurrently with an API suite in another checkout.

- [ ] **Step 6: Typecheck and lint**

```bash
npm run typecheck && npm run biome:check
```

Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/studio/features/agents/components/agent-form.shared.ts \
        apps/web/src/common/features/agents/agent.factory.ts \
        apps/web/src/eval/features/evaluation-conversation-runs/components/RunEvaluationConversationDialog.tsx \
        apps/web/src/eval/features/evaluation-conversation-runs/evaluation-conversation-runs.factory.ts \
        apps/api/src/domains/evaluations/conversation/runs/evaluation-conversation-run.factory.ts \
        apps/api/src/domains/evaluations/conversation/runs/evaluation-conversation-run-grader.service.ts
git commit -m "feat(agents): default new agents to gemini-3.5-flash-lite"
```

---

## Task 5: Story coverage for both banner states

`apps/web` has no component render tests — every existing spec is pure logic — so per ADR 0010
the rendering coverage is Storybook, with a control toggle so both states are reachable.

**Files:**
- Modify: `apps/web/src/stories/routes/studio/agent/AgentRoute.stories.tsx`
- Modify: `apps/web/src/stories/routes/studio/AgentEditorRoute.stories.tsx`

**Interfaces:**
- Consumes: `DeprecatedModelBanner` mounted in `StudioAgentRoute` (Task 3);
  `agent.factory.ts` defaulting to `DEFAULT_AGENT_MODEL` (Task 4). Both stories mount the real
  route tree via `render({ routes: studioRoutes, path })`, so the banner is exercised through
  the actual route wrapper rather than in isolation.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add the toggle to `AgentRoute.stories.tsx`**

Extend `StoryArgs` (currently lines 22-28):

```tsx
type StoryArgs = StudioStoryArgs & {
  agentType: AgentType
  fillForm?: boolean
  withAgentSessions?: boolean
  /** Unpublished draft revision — drives whether the header's publish button is enabled. */
  withDraft?: boolean
  /** Puts the agent on a retired model so the deprecation banner renders. */
  withDeprecatedModel?: boolean
}
```

Add to `meta.argTypes`:

```tsx
    withDeprecatedModel: { control: "boolean" },
```

Add to `meta.args`:

```tsx
    withDeprecatedModel: false,
```

In the `Default` decorator, destructure the new arg and apply it to the built agent. Replace the
decorator's opening line and the `currentAgent` assignment:

```tsx
    buildDecorator<StoryArgs>(
      ({ agentType, fillForm, withAgentSessions, withDraft, withDeprecatedModel, ...args }) => {
        const { baseSeeds, project, agents } = buildStudioData(args)
        const [firstAgent, ...restAgents] = agents
        const withFillForm = agentType === "conversation" && !!fillForm
        const currentAgent = (withFillForm ? agentFactory.fillForm() : agentFactory)
          .transient({ project })
          .build({
            ...firstAgent,
            type: agentType,
            fillFormEnabled: withFillForm,
            isDraft: !!withDraft,
            model: withDeprecatedModel ? AgentModel.Gemini25Flash : DEFAULT_AGENT_MODEL,
          })
```

Keep the rest of the decorator body unchanged, and adjust the closing parens for the extra
indentation level. Add the import:

```tsx
import { AgentModel, DEFAULT_AGENT_MODEL } from "@caseai-connect/api-contracts"
```

Then add a story that pins the deprecated state, after `AgentFillFormWithSessions`:

```tsx
export const AgentOnDeprecatedModel: Story = {
  args: {
    ...AgentConvWithSessions.args,
    withDeprecatedModel: true,
  },
  decorators: Default.decorators,
}
```

- [ ] **Step 2: Add the toggle to `AgentEditorRoute.stories.tsx`**

Extend `StoryArgs` (currently lines 16-20):

```tsx
type StoryArgs = StudioStoryArgs & {
  withSubAgents?: boolean
  /** Unpublished draft revision — drives whether the header's publish button is enabled. */
  withDraft?: boolean
  /** Puts the agent on a retired model so the deprecation banner renders. */
  withDeprecatedModel?: boolean
}
```

Add to `meta.argTypes`:

```tsx
    withDeprecatedModel: { control: "boolean" },
```

Add to `meta.args`:

```tsx
    withDeprecatedModel: false,
```

In the `ConversationAgent` decorator, destructure the arg and set the model on `parentAgent`:

```tsx
    buildDecorator<StoryArgs>(({ withSubAgents, withDraft, withDeprecatedModel, ...args }) => {
      const { baseSeeds, agents } = buildStudioData({ ...args, withAgents: true })
      const [rawParentAgent, ...rawChildAgents] = agents
      if (!rawParentAgent) {
        throw new Error("Agent editor route story requires a parent agent")
      }
      const parentAgent = {
        ...rawParentAgent,
        name: "Helpful Assistant",
        type: "conversation" as const,
        revision: 3,
        isDraft: !!withDraft,
        model: withDeprecatedModel ? AgentModel.Gemini25Flash : DEFAULT_AGENT_MODEL,
      }
```

Keep the rest unchanged. Add the import:

```tsx
import { AgentModel, DEFAULT_AGENT_MODEL } from "@caseai-connect/api-contracts"
```

`buildVersions` spreads `parentAgent`, so the seeded history inherits the same model — no extra
change needed there.

Add a pinned story after `ConversationAgent`:

```tsx
export const ConversationAgentOnDeprecatedModel: Story = {
  args: { withDeprecatedModel: true },
  decorators: ConversationAgent.decorators,
}
```

- [ ] **Step 3: Verify both states in Storybook (optional)**

```bash
npm run storybook --workspace=@caseai-connect/web -- -p 6007 --no-open
```

Check all four:

1. `routes/studio/project/agent → AgentConvWithSessions` — **no** banner.
2. `routes/studio/project/agent → AgentOnDeprecatedModel` — banner above the session list.
3. `routes/studio/project/agent/edit → ConversationAgent` — **no** banner, and the Model tab
   shows `gemini-3.5-flash-lite` selected with no `(deprecated)` suffix.
4. `routes/studio/project/agent/edit → ConversationAgentOnDeprecatedModel` — banner shown
   exactly once, and the Model tab shows `gemini-2.5-flash (deprecated)` selected.

Also confirm the `withDeprecatedModel` toggle in the controls panel flips the banner on and off
live in both route stories. Stop Storybook when done.

- [ ] **Step 4: Build Storybook to catch story-level errors**

This is the blocking gate for the stories — it compiles every story file, so a broken decorator or
a bad arg type fails here even when nobody opens a browser.

```bash
npm run build-storybook --workspace=@caseai-connect/web
```

Expected: exit 0.

- [ ] **Step 5: Full completion gates**

```bash
npm run biome:check && npm run typecheck && npm run test --workspace=@caseai-connect/web
```

Expected: all exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/stories/routes/studio/agent/AgentRoute.stories.tsx \
        apps/web/src/stories/routes/studio/AgentEditorRoute.stories.tsx
git commit -m "test(agents): cover both deprecated-model banner states in route stories"
```

---

## Final Verification

- [ ] **Run every gate from the repo root**

```bash
npm run biome:check
npm run typecheck
npm run test --workspace=@caseai-connect/web
```

All three must exit 0.

- [ ] **Run the API suite**

```bash
npx turbo test --filter=@caseai-connect/api
```

Note: the root `CLAUDE.md` documents `--filter=api`, which turbo rejects with
`No package found with name 'api' in workspace`. The filter must be the full package name.

Expected: PASS. If workers were SIGTERM'd or `csv-extraction cancel-one` fails, re-run those
files in isolation before treating it as a regression — that flakiness is pre-existing and
unrelated to this change.

- [ ] **Confirm the spec is fully covered**

```bash
grep -rn "vertex-3" --include=*.ts --include=*.tsx --include=*.json apps packages | grep -v node_modules
grep -rn "Gemini25Flash" --include=*.ts --include=*.tsx apps/web/src | grep -v stories | grep -v spec
```

First command: no output. Second: no output outside stories and specs — every remaining
`Gemini25Flash` reference in web should be a deliberate deprecated-state fixture.

- [ ] **Report status and stop**

Do not push or open a PR. Summarise what shipped and leave the branch for review — the user
drives `/end-feature`.
