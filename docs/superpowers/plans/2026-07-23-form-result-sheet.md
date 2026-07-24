# Form Result Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the always-on right-side "Form Result" panel with a "Show form state" trigger under the "Filling in the form…" step that opens the form result in a right-side sheet.

**Architecture:** Push the form state (agent `outputJsonSchema` + session `result`) from the route into a React context (`FormResultContext`) mounted in `AgentSessionMessages`, mirroring the existing `FormSubSessionsContext`. The deeply-nested step renderer (`CompletedSteps`/`StreamingSteps` in `AgentSessionMessage.tsx`) reads the context and, on the `fillForm` step, renders a sheet trigger reusing the existing `FormResultFields` renderer.

**Tech Stack:** React 19 (React Compiler), Redux Toolkit, react-i18next, `@caseai-connect/ui` (shad components: `Sheet`, `Button`), Storybook (visual verification), Vite/Vitest (no web unit-test files exist — see Global Constraints).

## Global Constraints

- **Frontend only.** No changes to `apps/api`, `packages/api-contracts`, or the database. All data (`agent.outputJsonSchema`, `agent.fillFormEnabled`, `session.result`) is already available at the route level.
- **No web unit-test harness.** `apps/web` has zero `*.test.tsx`/`*.spec.tsx` files; `npm run test` (vitest) finds nothing. Verification for every task is: `npm run typecheck` + `npm run biome:check` (both from repo root, exit 0), plus Storybook visual confirmation for the story task.
- **Type safety:** never use `any`, `as any`, `@ts-ignore`, or `@ts-expect-error` (web CLAUDE.md).
- **i18n:** every user-facing string comes from a locale key; add both `en` and `fr`. Reuse shared/existing keys before adding new ones.
- **Descriptive loop variables** — no single-letter names in `.map`/`.forEach`.
- **Exact types in play:**
  - `Agent.outputJsonSchema?: Record<string, unknown>`, `Agent.fillFormEnabled: boolean`.
  - `ConversationAgentSession.result?: Record<string, unknown>`.
  - `FormResultFields` props: `{ outputJsonSchema?: Record<string, unknown>; result?: Record<string, unknown> }`.
  - `ToolName.FillForm === "fillForm"`.
- Commit messages: Conventional Commits (`feat:`/`refactor:`/`chore:`). Do not add a `Co-Authored-By` trailer unless asked; keep the repo's existing style.

---

### Task 1: Add the form-result context, remove the right-side panel, rewire routes

Introduces the context + provider, deletes the panel, and switches the three routes from `rightSlot` to a `formResultSchema` prop. After this task the panel is gone everywhere and the context is available (no trigger consumer yet). App compiles.

**Files:**
- Create: `apps/web/src/common/features/agents/agent-sessions/shared/agent-session-messages/components/form-result-context.ts`
- Modify: `apps/web/src/common/features/agents/agent-sessions/shared/agent-session-messages/components/AgentSessionMessages.tsx`
- Modify: `apps/web/src/studio/routes/StudioAgentSessionRoute.tsx`
- Modify: `apps/web/src/desk/routes/DeskAgentSessionRoute.tsx`
- Modify: `apps/web/src/tester/features/review-campaigns/components/TesterAgentSession.tsx`
- Delete: `apps/web/src/common/features/agents/agent-sessions/conversation/components/FormResult.tsx`

**Interfaces:**
- Produces:
  - `type FormResultContextValue = { outputJsonSchema: Record<string, unknown>; result?: Record<string, unknown> }`
  - `FormResultProvider: React.Provider<FormResultContextValue | null>`
  - `useFormResult(): FormResultContextValue | null`
  - `AgentSessionMessages` new prop `formResultSchema?: Record<string, unknown>` (replaces `rightSlot`).

- [ ] **Step 1: Create the context file**

Create `apps/web/src/common/features/agents/agent-sessions/shared/agent-session-messages/components/form-result-context.ts`:

```ts
import { createContext, useContext } from "react"

/**
 * The form definition + accumulated result of the current fillForm-enabled agent
 * session, carried down to the individual tool-step renderers so the "Filling in
 * the form…" step can open the result in a sheet. Null when the agent has no
 * fillForm tool (or no schema), so those surfaces render no affordance.
 */
export type FormResultContextValue = {
  outputJsonSchema: Record<string, unknown>
  result?: Record<string, unknown>
}

const FormResultContext = createContext<FormResultContextValue | null>(null)

export const FormResultProvider = FormResultContext.Provider

export function useFormResult() {
  return useContext(FormResultContext)
}
```

- [ ] **Step 2: Rewire `AgentSessionMessages` — swap `rightSlot` for `formResultSchema` + provider**

In `AgentSessionMessages.tsx`:

Add the import (next to the existing `FormSubSessionsProvider` import):

```tsx
import { FormResultProvider } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/components/form-result-context"
```

Replace the component signature block (currently lines ~52-64):

```tsx
export function AgentSessionMessages({
  session,
  messages,
  onFillFormToolEvent,
  formSubSessions = [],
  formResultSchema,
}: {
  session: AgentSession
  messages: AgentSessionMessageType[]
  onFillFormToolEvent?: () => void
  formSubSessions?: ConversationSubSession[]
  formResultSchema?: Record<string, unknown>
}) {
  const isStreaming = useAppSelector(selectStreaming)
  const { t } = useTranslation()

  const formResult = formResultSchema
    ? { outputJsonSchema: formResultSchema, result: session.result }
    : null

  const desktopHeightClasses = "md:h-[calc(100dvh-17rem)]"
```

Note: `t` is still used elsewhere? After removing the mobile strip it may become unused. If `npm run biome:check` flags `t`/`useTranslation` as unused, remove both the `const { t } = useTranslation()` line and the `useTranslation` import. Verify at Step 5.

Replace the outer container opening tag + the entire `{rightSlot && ( … )}` block (currently lines ~69-93) with just the simplified container (drop `md:flex-row`, drop the whole rightSlot block):

```tsx
  return (
    <div className={cn("flex flex-1 flex-col min-h-0", desktopHeightClasses)}>
      <div className="flex flex-1 p-2 sm:p-4 min-h-0 md:min-h-full">
        <Chat className="border shadow-none">
          <MessageScrollerProvider scrollPreviousItemPeek={168} defaultScrollPosition="end">
            <FormSubSessionsProvider value={formSubSessions}>
              <FormResultProvider value={formResult}>
                <Messages messages={messages} />
              </FormResultProvider>
            </FormSubSessionsProvider>

            <Footer
              session={session}
              messages={messages}
              isStreaming={isStreaming}
              onFillFormToolEvent={onFillFormToolEvent}
            />
          </MessageScrollerProvider>
        </Chat>
      </div>
    </div>
  )
}
```

Remove the now-unused imports from `AgentSessionMessages.tsx`: `Collapsible`, `CollapsibleContent`, `CollapsibleTrigger` (they were only used by the mobile strip) and `ChevronDownIcon` from the `lucide-react` import (keep `FileCheckIcon`, `ListIcon`, `XIcon`). Verify at Step 5 that no other code in the file uses them.

- [ ] **Step 3: Update `StudioAgentSessionRoute.tsx`**

Remove the import line `import { FormResult } from "@/common/features/agents/agent-sessions/conversation/components/FormResult"`.

Replace the `<AgentSessionMessages … />` usage (currently ~lines 54-63):

```tsx
        <AgentSessionMessages
          session={agentSession}
          messages={messages}
          formSubSessions={formSubSessions}
          formResultSchema={agent.fillFormEnabled ? agent.outputJsonSchema : undefined}
        />
```

- [ ] **Step 4: Update `DeskAgentSessionRoute.tsx` and `TesterAgentSession.tsx`**

In `DeskAgentSessionRoute.tsx` remove the `FormResult` import and replace the usage:

```tsx
        <AgentSessionMessages
          session={agentSession}
          messages={messages}
          formResultSchema={agent.fillFormEnabled ? agent.outputJsonSchema : undefined}
        />
```

In `TesterAgentSession.tsx` remove the `FormResult` import and replace the usage (keep `onFillFormToolEvent`):

```tsx
        <AgentSessionMessages
          session={agentSession}
          messages={messages}
          formResultSchema={agent.fillFormEnabled ? agent.outputJsonSchema : undefined}
          onFillFormToolEvent={handleFillFormToolEvent}
        />
```

Then delete the file `apps/web/src/common/features/agents/agent-sessions/conversation/components/FormResult.tsx`:

```bash
git rm apps/web/src/common/features/agents/agent-sessions/conversation/components/FormResult.tsx
```

- [ ] **Step 5: Verify typecheck + lint**

Run (from repo root):

```bash
npm run typecheck && npm run biome:check
```

Expected: both exit 0. If biome flags unused `t`/`useTranslation`/`cn` or the removed lucide/collapsible imports in `AgentSessionMessages.tsx`, delete those unused imports/bindings and re-run until clean. (`cn` is still used by the container `className` — keep it.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(agents): drop the right-side form result panel for a context-fed sheet"
```

---

### Task 2: Add the `FormResultSheet` component + i18n keys

Creates the sheet (trigger + content) and its strings. Consumed in Task 3.

**Files:**
- Create: `apps/web/src/common/features/agents/agent-sessions/conversation/components/FormResultSheet.tsx`
- Modify: `apps/web/src/common/features/agents/agent-sessions/conversation/locales/conversation-agent-session.en.json`
- Modify: `apps/web/src/common/features/agents/agent-sessions/conversation/locales/conversation-agent-session.fr.json`

**Interfaces:**
- Produces: `FormResultSheet({ outputJsonSchema, result }: { outputJsonSchema: Record<string, unknown>; result?: Record<string, unknown> })`
- Consumes: `FormResultFields` (existing), `conversationAgentSession:props.result`, `conversationAgentSession:formState.show`, `conversationAgentSession:formState.description`.

- [ ] **Step 1: Add i18n keys (en)**

In `conversation-agent-session.en.json`, add a `formState` block inside `conversationAgentSession` (after `subAgentResults`):

```json
    "subAgentResults": {
      "view": "Form result",
      "title": "Sub-agent form results",
      "description": "Results collected by the form-filling sub-agents this agent delegated to."
    },
    "formState": {
      "show": "Show form state",
      "description": "The information the agent has collected so far."
    }
```

- [ ] **Step 2: Add i18n keys (fr)**

In `conversation-agent-session.fr.json`, add the matching block:

```json
    "subAgentResults": {
      "view": "Résultat du formulaire",
      "title": "Résultats des sous-agents de formulaire",
      "description": "Résultats collectés par les sous-agents de remplissage de formulaire auxquels cet agent a délégué."
    },
    "formState": {
      "show": "Afficher l'état du formulaire",
      "description": "Les informations que l'agent a collectées jusqu'à présent."
    }
```

- [ ] **Step 3: Create `FormResultSheet.tsx`**

Create `apps/web/src/common/features/agents/agent-sessions/conversation/components/FormResultSheet.tsx`:

```tsx
import { Button } from "@caseai-connect/ui/shad/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@caseai-connect/ui/shad/sheet"
import { ClipboardListIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { FormResultFields } from "@/common/features/agents/agent-sessions/conversation/components/FormResultFields"

/**
 * Opens the current form result of a fillForm-enabled session in a right-side
 * sheet. Triggered from the "Filling in the form…" step in the reasoning
 * timeline; reuses the shared FormResultFields renderer.
 */
export function FormResultSheet({
  outputJsonSchema,
  result,
}: {
  outputJsonSchema: Record<string, unknown>
  result?: Record<string, unknown>
}) {
  const { t } = useTranslation()

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto w-fit gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ClipboardListIcon className="size-3.5" />
          {t("conversationAgentSession:formState.show")}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("conversationAgentSession:props.result")}</SheetTitle>
          <SheetDescription>
            {t("conversationAgentSession:formState.description")}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <FormResultFields outputJsonSchema={outputJsonSchema} result={result} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

(`SheetDescription` is included so Radix Dialog does not warn about a missing description, matching `SubAgentFormResultSheet`.)

- [ ] **Step 4: Verify typecheck + lint**

```bash
npm run typecheck && npm run biome:check
```

Expected: both exit 0. (An exported-but-unused component is fine; it's wired in Task 3.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(agents): add FormResultSheet for the conversation form result"
```

---

### Task 3: Wire the "Show form state" trigger into the step timeline

Renders the `FormResultSheet` trigger under the `fillForm` step in both the streaming timeline and the collapsed "Worked through N steps" summary.

**Files:**
- Modify: `apps/web/src/common/features/agents/agent-sessions/shared/agent-session-messages/components/AgentSessionMessage.tsx`

**Interfaces:**
- Consumes: `useFormResult()` (Task 1), `FormResultSheet` (Task 2), `ToolName.FillForm` (already imported in this file).

- [ ] **Step 1: Add imports**

In `AgentSessionMessage.tsx`, add:

```tsx
import { FormResultSheet } from "@/common/features/agents/agent-sessions/conversation/components/FormResultSheet"
import { useFormResult } from "./form-result-context"
```

(`ToolName` is already imported from `@caseai-connect/api-contracts` at the top of the file.)

- [ ] **Step 2: Wire the trigger into `StreamingSteps`**

In `StreamingSteps`, read the context at the top of the component (just after `const toolSteps = useAppSelector(selectStreamingToolSteps)`):

```tsx
  const formResult = useFormResult()
```

Replace the `toolSteps.map(...)` block (currently the `<Marker key=…>…</Marker>` mapping) with a wrapped version that appends the sheet trigger on the fillForm step:

```tsx
        {toolSteps.map((toolName, stepIndex) => (
          <div key={`${stepIndex}-${toolName}`} className="flex flex-col gap-1.5">
            <Marker>
              <MarkerIcon>
                <CheckIcon className="text-emerald-600" />
              </MarkerIcon>
              <MarkerContent className="text-muted-foreground">
                {toolStepLabel(t, toolName)}
              </MarkerContent>
            </Marker>
            {toolName === ToolName.FillForm && formResult && (
              <div className="pl-6">
                <FormResultSheet
                  outputJsonSchema={formResult.outputJsonSchema}
                  result={formResult.result}
                />
              </div>
            )}
          </div>
        ))}
```

- [ ] **Step 3: Wire the trigger into `CompletedSteps`**

In `CompletedSteps`, read the context at the top (just after `const { t } = useTranslation()`):

```tsx
  const formResult = useFormResult()
```

Replace the `toolNames.map(...)` block with:

```tsx
          {toolNames.map((toolName, stepIndex) => (
            <div key={`${stepIndex}-${toolName}`} className="flex flex-col gap-1.5">
              <Marker>
                <MarkerIcon>
                  <CheckIcon className="text-emerald-600" />
                </MarkerIcon>
                <MarkerContent>{toolStepLabel(t, toolName)}</MarkerContent>
              </Marker>
              {toolName === ToolName.FillForm && formResult && (
                <div className="pl-6">
                  <FormResultSheet
                    outputJsonSchema={formResult.outputJsonSchema}
                    result={formResult.result}
                  />
                </div>
              )}
            </div>
          ))}
```

- [ ] **Step 4: Verify typecheck + lint**

```bash
npm run typecheck && npm run biome:check
```

Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(agents): show a form-state sheet trigger on the fill-form step"
```

---

### Task 4: Exercise the fillForm scenario in the route story (visual verification)

The web app has no unit tests, so the Storybook route story is the end-to-end check. The existing `FillFormSession` story toggles `fillForm` but its assistant message has no `fillForm` tool call, so no step (and no trigger) renders. Add the tool call so the story shows the "Filling in the form…" step, the "Show form state" trigger, and the sheet.

**Files:**
- Modify: `apps/web/src/stories/routes/studio/agent/AgentSessionRoute.stories.tsx`

**Interfaces:**
- Consumes: `ToolName.FillForm` from `@caseai-connect/api-contracts`.

- [ ] **Step 1: Import `ToolName`**

At the top of `AgentSessionRoute.stories.tsx`, add:

```tsx
import { ToolName } from "@caseai-connect/api-contracts"
```

- [ ] **Step 2: Add a fillForm tool call to the assistant message**

Replace the `assistantMessage` definition (currently `const assistantMessage = agentSessionMessageFactory.build({ role: "assistant", toolCalls: … })`) with a version that includes a `fillForm` tool call when `fillForm` is on:

```tsx
      const toolCalls = [
        ...(fillForm ? [{ id: faker.string.uuid(), name: ToolName.FillForm, arguments: {} }] : []),
        ...(withSubAgentForms
          ? subSessions.map((subSession) => ({
              id: faker.string.uuid(),
              name: subSession.toolName,
              arguments: {},
            }))
          : []),
      ]

      const assistantMessage = agentSessionMessageFactory.build({
        role: "assistant",
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      })
```

Also delete the outdated comment on the session line (`// fillForm-enabled agents accumulate a form result on the session, shown in the right panel.`) and replace with:

```tsx
      // fillForm-enabled agents accumulate a form result on the session, shown in the sheet.
```

- [ ] **Step 3: Verify typecheck + lint**

```bash
npm run typecheck && npm run biome:check
```

Expected: both exit 0.

- [ ] **Step 4: Visual verification in Storybook**

Run (from `apps/web`):

```bash
npm run storybook
```

Open story `routes/studio/project/agent/session` → **FillFormSession**. Confirm:
- No right-side "Form Result" panel and no mobile strip.
- The assistant turn shows "Worked through 1 step" → expand → "Filling in the form…" with a **Show form state** link under it.
- Clicking **Show form state** opens a right-side sheet titled "Form Result" listing the schema fields with the session result values.
- Switch the **Default** story (fillForm off): no trigger, no panel — unchanged chat.

Stop Storybook (Ctrl-C) when done.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test(agents): cover the fill-form sheet trigger in the session route story"
```

---

## Self-Review

**Spec coverage:**
- Remove right-side panel → Task 1 (delete `FormResult.tsx`, remove `rightSlot`, drop mobile strip + desktop sidebar). ✓
- Form result as a sheet under "Filling in the form…" via "Show form state" → Task 2 (sheet) + Task 3 (trigger on `fillForm` step). ✓
- Streaming + completed placement → Task 3 wires both `StreamingSteps` and `CompletedSteps`. ✓
- Context pattern mirroring `FormSubSessionsContext` → Task 1. ✓
- All three surfaces (Studio/Desk/Tester) → Task 1 rewires all three routes. ✓
- i18n en+fr → Task 2. ✓
- Story coverage → Task 4. ✓
- Accepted trade-offs (no empty-state entry point; streaming may lag; multiple triggers) → inherent to the design; no extra task needed.

**Placeholder scan:** No TBD/TODO; every code step shows complete code. ✓

**Type consistency:** `FormResultContextValue.outputJsonSchema: Record<string, unknown>` and `result?: Record<string, unknown>` match `FormResultFields` props and `FormResultSheet` props across Tasks 1-3; `formResultSchema?: Record<string, unknown>` matches `agent.outputJsonSchema`; `ToolName.FillForm` used consistently in Tasks 3-4. ✓
