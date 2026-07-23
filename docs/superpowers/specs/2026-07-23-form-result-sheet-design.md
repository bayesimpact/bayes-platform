# Form result panel → sheet under the "Filling in the form…" step

**Date:** 2026-07-23
**Status:** Approved (design)
**Scope:** `apps/web` only (frontend UI change; no API, contracts, or DB changes)

## Problem

Conversation agents with form filling enabled currently render the collected
form values in a permanent right-hand **Form Result** panel (`FormResult.tsx`),
injected via the `rightSlot` prop of `AgentSessionMessages`. On mobile the same
panel collapses into a strip above the chat.

We want to remove that always-on panel and instead surface the form state
on demand: a **"Show form state"** trigger under the "Filling in the form…"
step in the reasoning timeline, opening the result in a slide-over **sheet**.

## Goal

- Remove the right-side (and mobile-strip) `FormResult` panel.
- Add a "Show form state" trigger on the `FillForm` step of the reasoning
  timeline — in **both** the live streaming timeline and the collapsed
  "Worked through N steps" summary.
- Clicking it opens a right-side sheet showing the current form result,
  reusing the existing `FormResultFields` renderer.
- Applies to all three conversation surfaces: Studio, Desk, Tester.

## Non-goals

- No change to the sub-agent form result sheet (`SubAgentFormResultSheet`),
  which is a separate concern (per-sub-agent results, triggered from delegation
  tool calls in the message footer).
- No API / `api-contracts` / database changes. The data (`agent.outputJsonSchema`,
  `session.result`) is already available at the route level.
- No change to the reviewer-side `FormResultPanel` (separate namespace/surface).

## Approach

Mirror the existing `FormSubSessionsContext` pattern already used in this file
tree. The form state (schema + current result) is pushed from the route through
a React context down to the deeply-nested step renderer, which conditionally
shows the trigger. This avoids prop-drilling through
`AgentSessionMessages → Messages → AgentSessionMessage → ThinkingSteps →
CompletedSteps/StreamingSteps`, and matches how `SubAgentFormResultSheet`
already receives its data.

## Changes

### 1. Remove the right-side panel

- **Delete** `apps/web/src/common/features/agents/agent-sessions/conversation/components/FormResult.tsx`.
- **Keep** `FormResultFields.tsx` — the reusable key/value renderer, reused by the sheet.
- `AgentSessionMessages.tsx`:
  - Remove the `rightSlot` prop from the component signature and its type.
  - Remove the entire `{rightSlot && ( … )}` JSX branch: the mobile collapsible
    strip and the desktop `w-80` sidebar.
  - Simplify the outer container from `flex flex-1 flex-col md:flex-row` to
    `flex flex-1 flex-col` (there is no longer a right sibling). Keep the
    `min-h-0` / `desktopHeightClasses`.
- `rightSlot` has no other consumer (verified via grep), so it is removed entirely.

### 2. New form-result context

New file
`apps/web/src/common/features/agents/agent-sessions/shared/agent-session-messages/components/form-result-context.ts`,
modeled on `form-sub-sessions-context.ts`:

```ts
type FormResultContextValue = {
  outputJsonSchema: NonNullable<Agent["outputJsonSchema"]>
  result: ConversationAgentSession["result"]
}

const FormResultContext = createContext<FormResultContextValue | null>(null)
export const FormResultProvider = FormResultContext.Provider
export function useFormResult() {
  return useContext(FormResultContext)
}
```

`null` default → surfaces that don't enable fillForm render no trigger.

`AgentSessionMessages` gains a `formResultSchema?` prop (the agent's
`outputJsonSchema`, passed only when `fillFormEnabled`). It wraps `<Messages>`
in `FormResultProvider` right next to the existing `FormSubSessionsProvider`,
with value:

```ts
formResultSchema ? { outputJsonSchema: formResultSchema, result: session.result } : null
```

`session.result` is already reactive (route selector), so the sheet reflects the
current form state.

### 3. New `FormResultSheet.tsx`

`apps/web/src/common/features/agents/agent-sessions/conversation/components/FormResultSheet.tsx`,
modeled on `SubAgentFormResultSheet.tsx`:

- Props: `{ outputJsonSchema, result }`.
- `Sheet` + `SheetTrigger asChild` wrapping a small muted timeline-style button
  labelled "Show form state" (`t("conversationAgentSession:formState.show")`),
  matching the timeline's `text-xs text-muted-foreground` styling.
- `SheetContent side="right"` with `SheetHeader`/`SheetTitle`
  (`t("conversationAgentSession:props.result")` — "Form Result"), body renders
  `<FormResultFields outputJsonSchema={outputJsonSchema} result={result} />`.

### 4. Wire the trigger into the step timeline

In `AgentSessionMessage.tsx`, both `CompletedSteps` and `StreamingSteps` call
`useFormResult()`. When a rendered step's tool is `ToolName.FillForm` **and** the
context value is non-null, render the `FormResultSheet` trigger just under that
step's `Marker` (indented under the marker content). A shared small helper keeps
the two timelines consistent. When context is `null` (fillForm disabled or no
schema), nothing extra renders — the step keeps its plain label.

### 5. i18n

Add to `conversation-agent-session.en.json` / `.fr.json`:

```
"formState": { "show": "Show form state" }   // fr: "Afficher l'état du formulaire"
```

Sheet title reuses the existing `props.result` key ("Form Result" / "Résultat du
formulaire"), which the removed mobile strip also used.

### 6. Stories

The three route stories already exist. Ensure at least one seeds an assistant
message with a `FillForm` tool call on a fillForm-enabled agent (with an
`outputJsonSchema` and a `session.result`) so the "Show form state" trigger and
the sheet are reachable from Storybook controls. Add a seed toggle if needed.

## Data flow

```
Route (agent, agentSession)
  └─ AgentSessionMessages
       formResultSchema = agent.fillFormEnabled ? agent.outputJsonSchema : undefined
       └─ FormResultProvider value={{ outputJsonSchema, result: session.result }}
            └─ AgentSessionMessage
                 └─ ThinkingSteps
                      └─ CompletedSteps / StreamingSteps
                           └─ (step.tool === FillForm && ctx) → FormResultSheet
                                └─ Sheet → FormResultFields(outputJsonSchema, result)
```

## Trade-offs / consequences (accepted)

- **Streaming timing:** on the streaming timeline the sheet shows
  `session.result`, which may lag the in-progress fill-form tool call until the
  result is processed. Accepted (user chose "streaming + completed").
- **No empty-state entry point:** the form state is only reachable once a
  "Filling in the form…" step exists (i.e. the agent has run the tool at least
  once). An enabled-but-not-yet-filled form has no visible entry point until then.
  This follows directly from the requested placement. Accepted.
- **Multiple triggers:** if the agent fills the form across several turns, each
  such message shows its own "Show form state" trigger; all open the same current
  `session.result`. Consistent and acceptable.

## Verification

- `npm run biome:check` — pass
- `npm run typecheck` (apps/web) — pass
- Storybook: the fillForm route story renders the step + trigger, and the sheet
  opens with the seeded result.
