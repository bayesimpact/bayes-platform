# Studio playground settings version picker — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the Studio playground run any non-archived settings version of the agent, defaulting to the draft, instead of always running the latest published one.

**Architecture:** The stream request gains an optional `agentSettingsRevision`. The API resolves it for playground sessions only, and defaults a playground session with no revision to the latest revision including the draft. The web app keeps the per-session choice in the `agentSettings` slice, derives an effective revision (explicit pick, else draft, else published) through a pure function, and renders a select in the playground header where a static badge used to be.

**Tech Stack:** NestJS + TypeORM + Jest (API), React + Redux Toolkit + Vite + Vitest + Storybook (web), shared contracts in `packages/api-contracts`.

**Spec:** [docs/superpowers/specs/2026-08-10-playground-settings-version-picker-design.md](../specs/2026-08-10-playground-settings-version-picker-design.md)

**Issue:** [#622](https://github.com/bayesimpact/bayes-platform/issues/622)

## Global Constraints

- Every task ends green on `npm run biome:check` and `npm run typecheck` from the repo root. `biome:check` rewrites files, so run it before committing, not after.
- API tasks also end green on the touched spec: `cd apps/api && node --experimental-vm-modules ../../node_modules/jest/bin/jest.js --colors --runInBand --forceExit <path>`. Plain `npx jest` on a single file does not work in this repo.
- Web tasks also end green on `cd apps/web && npx vitest run <path>`.
- Never use `any`, `as any`, `@ts-ignore` or `@ts-expect-error` to settle a type error (apps/web/CLAUDE.md).
- Never use single-letter loop variables. `versions.map((version) => …)`, never `versions.map((v) => …)` (CLAUDE.md).
- NestJS DI needs runtime imports: services, controllers and guards use `import { X }` with a `// biome-ignore lint/style/useImportType` comment, never `import type` (apps/api/CLAUDE.md).
- Test data comes from fishery factories, never hand-built entities (apps/api/CLAUDE.md).
- Sample data stays domain-neutral (CLAUDE.md).
- Commit messages are Conventional Commits, matching repo history: `feat(playground): …`, `fix: …`, `chore: …`.
- Do not run `npm install`. If a worktree is used, `npm ci` at its root first.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `packages/api-contracts/src/agents/shared/agent-session-messages/agent-session-messages.routes.ts` | Carries `agentSettingsRevision` on the stream payload | 1 |
| `apps/api/.../streaming/streaming.controller.ts` | Resolves which settings a stream runs with; gates version choice to playground | 1 |
| `apps/api/.../streaming/e2e-tests/stream.spec.ts` | Proves the resolution table | 1 |
| `apps/web/.../agent-settings/agent-settings.functions.ts` | Pure version helpers: find draft, resolve effective revision | 2, 4 |
| `apps/web/.../agent-settings/agent-settings.slice.ts` | Stores the per-session choice | 2 |
| `apps/web/.../agent-settings/agent-settings.selectors.ts` | Exposes the effective revision to components and thunks | 2 |
| `apps/web/.../agent-session-messages/external/agent-session-messages-streaming.ts` | Builds the stream URL including the revision | 3 |
| `apps/web/.../agent-session-messages/agent-session-messages.thunks.ts` | Reads the effective revision when sending | 3 |
| `apps/web/src/studio/.../components/AgentSettingsVersionSelect.tsx` | The picker itself, presentational | 5 |
| `apps/web/src/studio/routes/StudioAgentSessionRoute.tsx` | Wires picker, message labels and form schema to the selection | 6 |
| `apps/web/src/stories/routes/studio/agent/AgentSessionRoute.stories.tsx` | Visual coverage of draft-selected and published-selected | 6 |

---

### Task 1: API accepts and resolves a settings revision

**Files:**
- Modify: `packages/api-contracts/src/agents/shared/agent-session-messages/agent-session-messages.routes.ts:47-53`
- Modify: `apps/api/src/domains/agents/shared/agent-session-messages/streaming/streaming.controller.ts`
- Test: `apps/api/src/domains/agents/shared/agent-session-messages/streaming/e2e-tests/stream.spec.ts`

**Interfaces:**
- Produces: `AgentSessionMessagesRoutes.stream.request.payload` gains `agentSettingsRevision?: number`. Task 3 sends it.
- Produces: nothing else. `resolveAgentSettings` is a private controller method.

**Background the implementer needs:**

`@Sse` handlers never return HTTP error statuses. Nest's `RouterResponseController.sse` catches whatever the handler throws (synchronously or through the Observable) and writes an SSE frame `event: error\ndata: <err.message>` with the response status still `200`. This was verified against the running stack, and the existing `should return error when empty content` test already relies on it. All assertions below check `response.text`, never `response.status`, apart from the untouched 401 test.

The controller's current `try` wraps the entire handler and rewrites every failure as `Invalid query format`. That has to shrink to cover only `JSON.parse`, otherwise every new error message below is swallowed.

- [ ] **Step 1: Branch off main**

```bash
git checkout -b feat/playground-settings-version-picker
```

- [ ] **Step 2: Widen the stream contract**

In `packages/api-contracts/src/agents/shared/agent-session-messages/agent-session-messages.routes.ts`, replace the `stream` route definition:

```ts
  stream: defineRoute<
    ResponseData<AgentSessionStreamResponse>,
    RequestPayload<{
      content: string
      attachmentDocumentId?: string
      /**
       * Settings revision the answer must run with. Playground sessions only: a live session
       * that sends one is rejected rather than silently ignored, so a caller can never believe
       * it tested a draft in production. Omitted, a playground session runs the latest revision
       * including the draft and a live session runs the latest published one.
       */
      agentSettingsRevision?: number
    }>
  >({
    method: "post",
    path: `${basePath}/stream`,
  }),
```

- [ ] **Step 3: Write the failing tests**

In `apps/api/.../streaming/e2e-tests/stream.spec.ts`, replace the imports, `createContext` and `subject` helpers, and append the new tests. The existing three tests keep exercising a live session, so their coverage is unchanged.

Replace the import of `createOrganizationWithAgent`:

```ts
import type { BaseAgentSessionTypeDto } from "@caseai-connect/api-contracts"
import type { Agent } from "@/domains/agents/agent.entity"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import type { Organization } from "@/domains/organizations/organization.entity"
import { createOrganizationWithAgentSession } from "@/domains/organizations/organization.factory"
import type { Project } from "@/domains/projects/project.entity"
```

Replace `createContext` and `subject`:

```ts
  const createContext = async ({
    sessionType = "live",
  }: { sessionType?: BaseAgentSessionTypeDto } = {}) => {
    const { user, organization, project, agent, agentSession, agentSettings } =
      await createOrganizationWithAgentSession({
        repositories,
        agentType: "conversation",
        params: { agentSession: { type: sessionType } },
      })
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    agentSessionId = agentSession.id
    auth0Id = user.auth0Id
    return { organization, project, agent, agentSettings, session: agentSession }
  }

  const subject = (content: string, agentSettingsRevision?: number) => {
    const path = AgentSessionMessagesRoutes.stream.getPath({
      organizationId,
      projectId,
      agentId,
      agentSessionId,
    })
    const query = JSON.stringify({ payload: { content, agentSettingsRevision } })
    const req = request(app.getHttpServer()).get(path).query({ q: query }).set("Connection", "close")
    if (accessToken) req.set("Authorization", `Bearer ${accessToken}`)
    return req
  }
```

Add a seeding helper just below `parseSseEvents`. The seeded agent already owns revision 1 (published) from the factory chain, so this only adds the extra revisions a test needs. `instructions` is what makes each revision observable: the mock LLM provider echoes a fixed string, so instead assert on the persisted `agent_settings_id` of the produced message.

```ts
  const seedRevision = async ({
    organization,
    project,
    agent,
    revision,
    isDraft = false,
    isArchived = false,
  }: {
    organization: Organization
    project: Project
    agent: Agent
    revision: number
    isDraft?: boolean
    isArchived?: boolean
  }) => {
    const settings = agentSettingsFactory
      .transient({ organization, project, agent })
      .build({ revision, isDraft, isArchived })
    await repositories.agentSettingsRepository.save(settings)
    return settings
  }

  /** Settings row the assistant reply was persisted against. */
  const findAssistantMessageSettingsId = async () => {
    const messages = await repositories.agentMessageRepository.find({
      where: { sessionId: agentSessionId, role: "assistant" },
    })
    return messages[0]?.agentSettingsId
  }

  const errorData = (text: string) =>
    text
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trim())
      .join("")
```

Then append the tests:

```ts
  describe("settings version selection", () => {
    it("runs the requested published revision in the playground", async () => {
      const { organization, project, agent } = await createContext({ sessionType: "playground" })
      const published2 = await seedRevision({ organization, project, agent, revision: 2 })

      const response = await subject("Hello", 2)

      expect(response.text).not.toContain("event: error")
      expect(await findAssistantMessageSettingsId()).toBe(published2.id)
    })

    it("runs the requested draft revision in the playground", async () => {
      const { organization, project, agent } = await createContext({ sessionType: "playground" })
      const draft2 = await seedRevision({
        organization,
        project,
        agent,
        revision: 2,
        isDraft: true,
      })

      const response = await subject("Hello", 2)

      expect(response.text).not.toContain("event: error")
      expect(await findAssistantMessageSettingsId()).toBe(draft2.id)
    })

    it("defaults a playground session with no revision to the draft", async () => {
      const { organization, project, agent } = await createContext({ sessionType: "playground" })
      const draft2 = await seedRevision({
        organization,
        project,
        agent,
        revision: 2,
        isDraft: true,
      })

      const response = await subject("Hello")

      expect(response.text).not.toContain("event: error")
      expect(await findAssistantMessageSettingsId()).toBe(draft2.id)
    })

    it("defaults a playground session with no draft to the published revision", async () => {
      const { organization, project, agent, agentSettings } = await createContext({
        sessionType: "playground",
      })
      await seedRevision({ organization, project, agent, revision: 2, isArchived: true })

      const response = await subject("Hello")

      expect(response.text).not.toContain("event: error")
      expect(await findAssistantMessageSettingsId()).toBe(agentSettings.id)
    })

    it("rejects an unknown revision", async () => {
      await createContext({ sessionType: "playground" })

      const response = await subject("Hello", 99)

      expect(response.text).toContain("event: error")
      expect(errorData(response.text)).toContain("Version 99 not found")
    })

    it("rejects an archived revision", async () => {
      const { organization, project, agent } = await createContext({ sessionType: "playground" })
      await seedRevision({ organization, project, agent, revision: 2, isArchived: true })

      const response = await subject("Hello", 2)

      expect(response.text).toContain("event: error")
      expect(errorData(response.text)).toContain("archived")
    })

    it("rejects a revision on a live session", async () => {
      const { organization, project, agent } = await createContext({ sessionType: "live" })
      await seedRevision({ organization, project, agent, revision: 2 })

      const response = await subject("Hello", 2)

      expect(response.text).toContain("event: error")
      expect(errorData(response.text)).toContain("playground")
    })

    it("keeps running the published revision on a live session with no revision", async () => {
      const { organization, project, agent, agentSettings } = await createContext({
        sessionType: "live",
      })
      await seedRevision({ organization, project, agent, revision: 2, isDraft: true })

      const response = await subject("Hello")

      expect(response.text).not.toContain("event: error")
      expect(await findAssistantMessageSettingsId()).toBe(agentSettings.id)
    })
  })
```

- [ ] **Step 4: Run the tests to verify they fail**

```bash
cd apps/api && node --experimental-vm-modules ../../node_modules/jest/bin/jest.js --colors --runInBand --forceExit src/domains/agents/shared/agent-session-messages/streaming/e2e-tests/stream.spec.ts
```

Expected: the three original tests pass, the eight new ones fail. The "requested revision" ones fail because the controller ignores `agentSettingsRevision` and always resolves the published revision; the rejection ones fail because no error is produced at all.

- [ ] **Step 5: Rewrite the controller**

Replace the whole body of `apps/api/src/domains/agents/shared/agent-session-messages/streaming/streaming.controller.ts` with the listing below. It leaves out the access check, which now sits on the `live-streaming.controller.ts` and `playground-streaming.controller.ts` subclasses, each with its own `@CheckPermission`.

```ts
import { AgentSessionMessagesRoutes, type StreamEvent } from "@caseai-connect/api-contracts"
import type { MessageEvent } from "@nestjs/common"
import {
  Controller,
  ForbiddenException,
  NotFoundException,
  Query,
  Req,
  Sse,
  UnprocessableEntityException,
  UseGuards,
} from "@nestjs/common"
import { Observable } from "rxjs"
import type { EndpointRequestWithAgentSession } from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { UserGuard } from "@/domains/users/user.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { StreamingService } from "./streaming.service"
import type { AgentSessionScope } from "./streaming-session.types"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard)
@RequireContext("organization", "project", "agent", "agentSession")
@Controller()
export class StreamingController {
  constructor(
    private readonly chatStreamingService: StreamingService,
    private readonly agentSettingsService: AgentSettingsService,
  ) {}

  @Sse(AgentSessionMessagesRoutes.stream.path, { method: 0 /* GET */ })
  stream(
    @Req() request: EndpointRequestWithAgentSession<ConversationAgentSession>,
    @Query("q") query: string,
  ): Observable<MessageEvent> {
    const payload = parseStreamPayload(query)
    const userContent = payload.content
    const attachmentDocumentId = payload.attachmentDocumentId
    const agentSettingsRevision = payload.agentSettingsRevision
    const agent = request.agent
    const session = request.agentSession
    const connectScope = getRequiredConnectScope(request)
    // Settings are looked up on the organization/project pair only, as they were before this
    // route could name a revision. Widening the scope here would change which rows match.
    const settingsScope: RequiredConnectScope = {
      organizationId: request.organizationId,
      projectId: request.project.id,
    }

    if (!userContent) {
      throw new ForbiddenException("Missing user content")
    }

    if (typeof userContent === "string" && !userContent.trim()) {
      throw new ForbiddenException("User content must not be empty")
    }

    if (agentSettingsRevision !== undefined && session.type !== "playground") {
      throw new ForbiddenException(
        "Choosing a settings version is only available in the playground",
      )
    }

    return new Observable<StreamEvent>((subscriber) => {
      void (async () => {
        try {
          const agentSettings = await this.resolveAgentSettings({
            connectScope: settingsScope,
            agentId: agent.id,
            sessionType: session.type,
            revision: agentSettingsRevision,
          })
          const agentSessionScope: AgentSessionScope = {
            connectScope,
            agent,
            agentSettings,
            session,
          }
          const events = this.chatStreamingService.streamAgentResponse({
            agentSessionScope,
            userContent,
            attachmentDocumentId,
            notifyClient: (event) => {
              subscriber.next(event)
            },
          })

          for await (const event of events) {
            subscriber.next(event)
          }

          subscriber.complete()
        } catch (error) {
          subscriber.error(error)
        }
      })()
    })
  }

  /**
   * Settings the answer runs with.
   *
   * A playground session with no explicit revision runs the draft when there is one. The Studio
   * playground renders before its settings history has loaded, so the client cannot always name
   * a revision, and defaulting that window to the published one would run a version the header
   * does not claim. A live session keeps running the newest published revision; it can never
   * reach here with a revision, that is rejected in the handler.
   */
  private async resolveAgentSettings({
    connectScope,
    agentId,
    sessionType,
    revision,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    sessionType: ConversationAgentSession["type"]
    revision: number | undefined
  }): Promise<AgentSettings> {
    if (revision === undefined) {
      return sessionType === "playground"
        ? this.agentSettingsService.getLast({ connectScope, agentId, includesDraft: true })
        : this.agentSettingsService.getLast({ connectScope, agentId })
    }

    const agentSettings = await this.agentSettingsService.get({ connectScope, agentId, revision })
    if (!agentSettings) {
      throw new NotFoundException(`Version ${revision} not found for agent ${agentId}`)
    }
    if (agentSettings.isArchived) {
      throw new UnprocessableEntityException(`Version ${revision} is archived and cannot be run`)
    }
    return agentSettings
  }
}

/**
 * The stream is a GET, so its payload travels JSON-encoded in `?q=`. Only the parse is guarded:
 * a wider try would rewrite every downstream failure as "Invalid query format" and hide which
 * version was rejected and why.
 */
function parseStreamPayload(
  query: string,
): (typeof AgentSessionMessagesRoutes.stream.request)["payload"] {
  try {
    return (JSON.parse(query) as typeof AgentSessionMessagesRoutes.stream.request).payload
  } catch (_) {
    throw new ForbiddenException("Invalid query format")
  }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
cd apps/api && node --experimental-vm-modules ../../node_modules/jest/bin/jest.js --colors --runInBand --forceExit src/domains/agents/shared/agent-session-messages/streaming/e2e-tests/stream.spec.ts
```

Expected: 11 passed, 11 total.

- [ ] **Step 7: Run the sibling message specs, which share the stream's persistence path**

```bash
cd apps/api && node --experimental-vm-modules ../../node_modules/jest/bin/jest.js --colors --runInBand --forceExit src/domains/agents/shared/agent-session-messages/e2e-tests
```

Expected: all pass. If `list-messages.spec.ts` fails, the settings-scope change is the suspect: revert `settingsScope` to `getRequiredConnectScope(request)` only if the tests demand it, and record why.

- [ ] **Step 8: Gate and commit**

```bash
cd /home/alexis_bayesimpact_org/bayes-platform && npm run biome:check && npm run typecheck
git add packages/api-contracts/src/agents/shared/agent-session-messages/agent-session-messages.routes.ts apps/api/src/domains/agents/shared/agent-session-messages/streaming/
git commit -m "feat(playground): let the stream request name the settings version to run"
```

---

### Task 2: Per-session version choice in Redux

**Files:**
- Modify: `apps/web/src/common/features/agents/agent-settings/agent-settings.functions.ts`
- Modify: `apps/web/src/common/features/agents/agent-settings/agent-settings.slice.ts`
- Modify: `apps/web/src/common/features/agents/agent-settings/agent-settings.selectors.ts`
- Test: `apps/web/src/common/features/agents/agent-settings/agent-settings.functions.spec.ts`

**Interfaces:**
- Produces: `findDraftVersion(versions: AgentSettings[]): AgentSettings | undefined`
- Produces: `resolveEffectiveRevision({ versions, chosenRevision }: { versions: AgentSettings[]; chosenRevision: number | undefined }): number | undefined`
- Produces: `agentSettingsActions.setPlaygroundRevision({ agentSessionId: string, revision: number })`
- Produces: `selectPlaygroundRevision({ agentId, agentSessionId }: { agentId: string; agentSessionId: string })`, a selector factory returning `number | undefined`. Tasks 3 and 6 consume it.

The decision logic lives in a pure function rather than inside the selector so it can be unit-tested without building a `RootState`, matching how `findPublishedVersion` and `findVersion` are already tested in this repo.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/src/common/features/agents/agent-settings/agent-settings.functions.spec.ts`, and add `findDraftVersion` and `resolveEffectiveRevision` to the existing import from `./agent-settings.functions`:

```ts
describe("findDraftVersion", () => {
  it("returns the draft version", () => {
    const versions = buildVersions({ revision: 5, isDraft: true }, { revision: 4 })

    expect(findDraftVersion(versions)?.revision).toBe(5)
  })

  it("returns undefined when every version is published", () => {
    expect(findDraftVersion(buildVersions({ revision: 4 }, { revision: 3 }))).toBeUndefined()
  })
})

describe("resolveEffectiveRevision", () => {
  it("honours an explicit choice", () => {
    const versions = buildVersions({ revision: 5, isDraft: true }, { revision: 4 }, { revision: 3 })

    expect(resolveEffectiveRevision({ versions, chosenRevision: 3 })).toBe(3)
  })

  it("defaults to the draft when there is no explicit choice", () => {
    const versions = buildVersions({ revision: 5, isDraft: true }, { revision: 4 })

    expect(resolveEffectiveRevision({ versions, chosenRevision: undefined })).toBe(5)
  })

  it("defaults to the published version when there is no draft", () => {
    const versions = buildVersions({ revision: 4 }, { revision: 3 })

    expect(resolveEffectiveRevision({ versions, chosenRevision: undefined })).toBe(4)
  })

  it("falls back to the default when the chosen revision left the list", () => {
    // Another tab archived revision 3 while it was selected here. Keeping the stale number would
    // send the API a revision it rejects, so the default takes over instead.
    const versions = buildVersions({ revision: 5, isDraft: true }, { revision: 4 })

    expect(resolveEffectiveRevision({ versions, chosenRevision: 3 })).toBe(5)
  })

  it("returns undefined when the history is empty", () => {
    expect(resolveEffectiveRevision({ versions: [], chosenRevision: undefined })).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd apps/web && npx vitest run src/common/features/agents/agent-settings/agent-settings.functions.spec.ts
```

Expected: FAIL, `findDraftVersion is not a function` / `resolveEffectiveRevision is not a function`.

- [ ] **Step 3: Add the pure helpers**

In `apps/web/src/common/features/agents/agent-settings/agent-settings.functions.ts`, add below `findPublishedVersion`:

```ts
/** The unpublished revision, when the agent has one. There is at most one per agent. */
export function findDraftVersion(versions: AgentSettings[]): AgentSettings | undefined {
  return versions.find((version) => version.isDraft)
}

/**
 * Revision the playground runs new messages with: the user's explicit pick, else the draft, else
 * the published version. Defaulting to the draft is the point of the feature — a draft exists to
 * be tested, and requiring a publish to try it defeats it.
 *
 * A pick that is no longer in the list (archived or published elsewhere since it was made) is
 * treated as no pick at all, so the UI never offers a revision the API would reject.
 *
 * `undefined` means the history is not loaded yet. Callers must send no revision at all in that
 * case; the API applies the same draft-first default server-side.
 */
export function resolveEffectiveRevision({
  versions,
  chosenRevision,
}: {
  versions: AgentSettings[]
  chosenRevision: number | undefined
}): number | undefined {
  if (chosenRevision !== undefined && findVersion(versions, chosenRevision)) return chosenRevision
  return (findDraftVersion(versions) ?? findPublishedVersion(versions))?.revision
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd apps/web && npx vitest run src/common/features/agents/agent-settings/agent-settings.functions.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Store the choice in the slice**

In `apps/web/src/common/features/agents/agent-settings/agent-settings.slice.ts`, replace the state shape, initial state and reducers:

```ts
import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import { ADS, type AsyncData } from "@/common/store/async-data-status"
import type { Agent } from "../agents.models"
import type { AgentSettings } from "./agent-settings.models"
import { listAgentSettings } from "./agent-settings.thunks"

type DataType = Record<Agent["id"], AsyncData<AgentSettings[]>> // keyed by agentId

interface State {
  history: DataType
  /**
   * Version the playground runs, per session. Deliberately not persisted: a reload starts over
   * from the draft-first default, which is the version a tester wants nine times out of ten.
   */
  playgroundRevisionBySessionId: Record<string, number>
}

const initialState: State = {
  history: {},
  playgroundRevisionBySessionId: {},
}
```

and add the reducer alongside `mount` / `unmount` / `reset`:

```ts
    setPlaygroundRevision: (
      state,
      action: PayloadAction<{ agentSessionId: string; revision: number }>,
    ) => {
      state.playgroundRevisionBySessionId[action.payload.agentSessionId] = action.payload.revision
    },
```

- [ ] **Step 6: Expose the effective revision as a selector**

In `apps/web/src/common/features/agents/agent-settings/agent-settings.selectors.ts`, add the import and the selector:

```ts
import { resolveEffectiveRevision } from "./agent-settings.functions"

const selectPlaygroundRevisions = (state: RootState) =>
  state.agentSettings.playgroundRevisionBySessionId

/**
 * Revision the playground runs new messages with for this session. `undefined` while the history
 * is still loading — callers must then send no revision and let the API apply its own default.
 */
export const selectPlaygroundRevision = ({
  agentId,
  agentSessionId,
}: {
  agentId: string
  agentSessionId: string
}) =>
  createSelector(
    [selectAgentSettingsHistoryData, selectPlaygroundRevisions],
    (history, revisionBySessionId): number | undefined => {
      const agentHistory = history[agentId]
      if (!agentHistory || !ADS.isFulfilled(agentHistory)) return undefined

      return resolveEffectiveRevision({
        versions: agentHistory.value,
        chosenRevision: revisionBySessionId[agentSessionId],
      })
    },
  )
```

- [ ] **Step 7: Gate and commit**

```bash
cd /home/alexis_bayesimpact_org/bayes-platform && npm run biome:check && npm run typecheck
cd apps/web && npx vitest run
cd /home/alexis_bayesimpact_org/bayes-platform
git add apps/web/src/common/features/agents/agent-settings/
git commit -m "feat(playground): track the chosen settings version per session"
```

---

### Task 3: Send the chosen revision with each message

**Files:**
- Modify: `apps/web/src/common/features/agents/agent-sessions/shared/agent-session-messages/external/agent-session-messages-streaming.ts`
- Modify: `apps/web/src/common/features/agents/agent-sessions/shared/agent-session-messages/agent-session-messages.thunks.ts`
- Test: create `apps/web/src/common/features/agents/agent-sessions/shared/agent-session-messages/external/agent-session-messages-streaming-url.spec.ts`

**Interfaces:**
- Consumes: `selectPlaygroundRevision` from Task 2, `agentSettingsRevision` on the contract from Task 1.
- Produces: `buildStreamUrl(...)` in a new sibling module `agent-session-messages-streaming-url.ts`, and a `agentSettingsRevision?: number` parameter on `streamChatResponse`.

The URL builder moves to its own module rather than being exported from `agent-session-messages-streaming.ts`: that file imports the Auth0 client transitively, which throws `ReferenceError: window is not defined` under vitest. A sibling module with no side-effecting imports is testable.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/common/features/agents/agent-sessions/shared/agent-session-messages/external/agent-session-messages-streaming-url.spec.ts`:

```ts
import { describe, expect, it } from "vitest"
import { buildStreamUrl } from "./agent-session-messages-streaming-url"

const params = {
  baseURL: "https://api.example.test",
  organizationId: "org-1",
  projectId: "project-1",
  agentId: "agent-1",
  agentSessionId: "session-1",
}

const decodePayload = (url: string) => {
  const query = new URL(url).searchParams.get("q")
  return JSON.parse(query ?? "{}") as { payload: Record<string, unknown> }
}

describe("buildStreamUrl", () => {
  it("carries the chosen settings revision", () => {
    const url = buildStreamUrl({ ...params, content: "Hello", agentSettingsRevision: 3 })

    expect(decodePayload(url).payload.agentSettingsRevision).toBe(3)
  })

  it("omits the revision when none was chosen", () => {
    const url = buildStreamUrl({ ...params, content: "Hello" })

    expect(decodePayload(url).payload).not.toHaveProperty("agentSettingsRevision")
  })

  it("keeps the content and the attachment in the payload", () => {
    const url = buildStreamUrl({
      ...params,
      content: "Hello",
      attachmentDocumentId: "attachment-1",
    })

    expect(decodePayload(url).payload).toMatchObject({
      content: "Hello",
      attachmentDocumentId: "attachment-1",
    })
  })

  it("points at the session's stream path", () => {
    const url = buildStreamUrl({ ...params, content: "Hello" })

    expect(new URL(url).pathname).toBe(
      "/organizations/org-1/projects/project-1/agents/agent-1/agent-sessions/session-1/stream",
    )
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/web && npx vitest run src/common/features/agents/agent-sessions/shared/agent-session-messages/external/agent-session-messages-streaming-url.spec.ts
```

Expected: FAIL, cannot resolve `./agent-session-messages-streaming-url`.

- [ ] **Step 3: Create the URL builder**

Create `apps/web/src/common/features/agents/agent-sessions/shared/agent-session-messages/external/agent-session-messages-streaming-url.ts`:

```ts
import { AgentSessionMessagesRoutes } from "@caseai-connect/api-contracts"

/**
 * The stream is a GET, so its payload travels JSON-encoded in `?q=`.
 *
 * `agentSettingsRevision` is omitted rather than sent as `undefined` when the caller has no
 * choice to express: the API rejects the field outright on a live session, so the absent-vs-null
 * distinction is load-bearing, not cosmetic.
 */
export function buildStreamUrl({
  baseURL,
  organizationId,
  projectId,
  agentId,
  agentSessionId,
  content,
  attachmentDocumentId,
  agentSettingsRevision,
}: {
  baseURL: string
  organizationId: string
  projectId: string
  agentId: string
  agentSessionId: string
  content: string
  attachmentDocumentId?: string
  agentSettingsRevision?: number
}): string {
  const body = {
    payload: {
      content,
      attachmentDocumentId,
      ...(agentSettingsRevision !== undefined && { agentSettingsRevision }),
    },
  } satisfies typeof AgentSessionMessagesRoutes.stream.request
  const path = AgentSessionMessagesRoutes.stream.getPath({
    organizationId,
    projectId,
    agentId,
    agentSessionId,
  })
  return `${baseURL}${path}?q=${encodeURIComponent(JSON.stringify(body))}`
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd apps/web && npx vitest run src/common/features/agents/agent-sessions/shared/agent-session-messages/external/agent-session-messages-streaming-url.spec.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Use the builder in `streamChatResponse`**

In `apps/web/.../external/agent-session-messages-streaming.ts`, replace the `AgentSessionMessagesRoutes` import with `import { buildStreamUrl } from "./agent-session-messages-streaming-url"` (keep the `type StreamEvent` import from the contracts package), add `agentSettingsRevision` to the parameter object and its type, and replace the `body` / `url` block:

```ts
    const token = await getAccessToken()
    const url = buildStreamUrl({
      baseURL: import.meta.env.VITE_API_URL as string,
      organizationId,
      projectId,
      agentId,
      agentSessionId,
      content,
      attachmentDocumentId,
      agentSettingsRevision,
    })
```

- [ ] **Step 6: Read the revision in the thunk**

In `apps/web/.../agent-session-messages.thunks.ts`, add the imports:

```ts
import { selectPlaygroundRevision } from "@/common/features/agents/agent-settings/agent-settings.selectors"
```

and inside `sendMessage`, just after `agentSessionId` is resolved:

```ts
    // Only the playground may name a version; the API rejects one on a live session. `buildType`
    // is the same signal the session was created with, so the two can never disagree.
    const agentSettingsRevision =
      buildType() === "playground"
        ? selectPlaygroundRevision({ agentId, agentSessionId })(state)
        : undefined
```

then pass `agentSettingsRevision` in the `streamChatResponse({ … })` call.

- [ ] **Step 7: Gate and commit**

```bash
cd /home/alexis_bayesimpact_org/bayes-platform && npm run biome:check && npm run typecheck
cd apps/web && npx vitest run
cd /home/alexis_bayesimpact_org/bayes-platform
git add apps/web/src/common/features/agents/agent-sessions/
git commit -m "feat(playground): send the chosen settings version with each message"
```

---

### Task 4: Label the in-flight message with the version that is actually running

**Files:**
- Modify: `apps/web/src/common/features/agents/agent-settings/agent-settings.functions.ts:76-94`
- Modify: `apps/web/src/studio/routes/StudioAgentSessionRoute.tsx:56-68`
- Test: `apps/web/src/common/features/agents/agent-settings/agent-settings.functions.spec.ts:46-86`

**Interfaces:**
- Produces: `resolveMessageRevision(message: AgentSessionMessage, fallbackRevision: number | undefined): number | undefined`. Task 6 passes the effective revision as the fallback.

`resolveMessageRevision` currently derives its own fallback from the published version, which stops being true the moment the playground can run a draft. This task changes the signature and keeps the single caller on today's behaviour; Task 6 swaps the argument.

- [ ] **Step 1: Rewrite the failing tests**

In `apps/web/.../agent-settings.functions.spec.ts`, replace the whole `describe("resolveMessageRevision", …)` block:

```ts
describe("resolveMessageRevision", () => {
  it("uses the revision recorded on the message", () => {
    const message = agentSessionMessageFactory.build({ role: "assistant", agentRevision: 3 })

    expect(resolveMessageRevision(message, 4)).toBe(3)
  })

  it("labels a still-unsaved streamed message with the version being run", () => {
    // Messages built client-side during streaming have no `createdAt` and no revision. The
    // caller passes whichever version the playground is currently set to, which is what the
    // stream ran with — not necessarily the published one, now that a draft can be selected.
    const message = agentSessionMessageFactory.build({ role: "assistant" })

    expect(resolveMessageRevision(message, 5)).toBe(5)
  })

  it("hides the badge for a server-loaded message with no revision", () => {
    // A persisted message always has `createdAt`. If its revision is missing the transport
    // dropped it, and claiming the running revision would mislabel an old message — so report
    // nothing instead.
    const message = agentSessionMessageFactory.build({
      role: "assistant",
      createdAt: Date.now() - 1000 * 60 * 60,
    })

    expect(resolveMessageRevision(message, 4)).toBeUndefined()
  })

  it("returns undefined when there is no recorded revision and no fallback", () => {
    const message = agentSessionMessageFactory.build({ role: "assistant" })

    expect(resolveMessageRevision(message, undefined)).toBeUndefined()
  })

  it("keeps a recorded revision that is absent from the history list", () => {
    const message = agentSessionMessageFactory.build({ role: "assistant", agentRevision: 2 })

    expect(resolveMessageRevision(message, 4)).toBe(2)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd apps/web && npx vitest run src/common/features/agents/agent-settings/agent-settings.functions.spec.ts
```

Expected: FAIL. `resolveMessageRevision(message, 5)` returns `undefined` because the second argument is still treated as a `AgentSettings[]` and `findPublishedVersion(5)` cannot run.

- [ ] **Step 3: Change the signature**

In `apps/web/.../agent-settings.functions.ts`, replace `resolveMessageRevision` entirely:

```ts
/**
 * Revision to label a message with: the one the API recorded on it.
 *
 * Messages built client-side during streaming have no revision yet and are never refetched, so
 * they fall back to `fallbackRevision` — the version the playground was set to when the stream
 * started, which is exactly what produced the answer.
 *
 * A persisted message with no revision must NOT fall back: labelling an old message with the
 * running revision would claim it is the current version. Returns `undefined` instead, so the
 * caller hides the badge rather than showing a wrong number.
 */
export function resolveMessageRevision(
  message: AgentSessionMessage,
  fallbackRevision: number | undefined,
): number | undefined {
  if (message.agentRevision !== undefined) return message.agentRevision
  const isPersisted = message.createdAt !== undefined
  return isPersisted ? undefined : fallbackRevision
}
```

- [ ] **Step 4: Keep the caller compiling on today's behaviour**

In `apps/web/src/studio/routes/StudioAgentSessionRoute.tsx`, move the `publishedVersion` binding above `renderMessageVersion` and pass its revision:

```tsx
  const publishedVersion = findPublishedVersion(versions)

  const renderMessageVersion = (message: AgentSessionMessage) => {
    if (!canManageAgent) return null
    const revision = resolveMessageRevision(message, publishedVersion?.revision)
    if (revision === undefined) return null
    return (
      <AgentRevisionBadge
        agent={agent}
        revision={revision}
        versions={versions}
        tooltipKey="messageRevisionTooltip"
      />
    )
  }
```

Delete the now-duplicated `const publishedVersion = findPublishedVersion(versions)` that sat below.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd apps/web && npx vitest run src/common/features/agents/agent-settings/agent-settings.functions.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Gate and commit**

```bash
cd /home/alexis_bayesimpact_org/bayes-platform && npm run biome:check && npm run typecheck
git add apps/web/src/common/features/agents/agent-settings/ apps/web/src/studio/routes/StudioAgentSessionRoute.tsx
git commit -m "refactor(playground): take the message revision fallback as an argument"
```

---

### Task 5: The version select component

**Files:**
- Create: `apps/web/src/studio/features/agents/agent-settings/components/AgentSettingsVersionSelect.tsx`
- Modify: `apps/web/src/common/features/agents/agent-settings/locales/agent-settings.en.json`
- Modify: `apps/web/src/common/features/agents/agent-settings/locales/agent-settings.fr.json`

**Interfaces:**
- Produces: `AgentSettingsVersionSelect({ versions, revision, disabled, onRevisionChange })`. Task 6 mounts it.

Presentational only, no Redux. It is not a form field, so ADR 0012's react-hook-form rule does not apply; it is a control in a page header, like the existing badge it replaces. Wording is copied from `evaluationConversationRun:version.*` so the two places read identically, per the spec's decision not to refactor the eval dialog.

- [ ] **Step 1: Add the English keys**

In `agent-settings.en.json`, inside the `agentSettings` object and right after the `history` block, add:

```json
    "version": {
      "ariaLabel": "Settings version new messages run with",
      "placeholder": "Select a version",
      "item": "v{{revision}} — {{detail}}",
      "current": "Current ({{date}})"
    },
```

- [ ] **Step 2: Add the French keys**

In `agent-settings.fr.json`, at the same position:

```json
    "version": {
      "ariaLabel": "Version des paramètres utilisée par les nouveaux messages",
      "placeholder": "Sélectionner une version",
      "item": "v{{revision}} — {{detail}}",
      "current": "Actuelle ({{date}})"
    },
```

- [ ] **Step 3: Write the component**

Create `apps/web/src/studio/features/agents/agent-settings/components/AgentSettingsVersionSelect.tsx`:

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@caseai-connect/ui/shad/select"
import { cn } from "@caseai-connect/ui/utils"
import { useTranslation } from "react-i18next"
import { findPublishedVersion } from "@/common/features/agents/agent-settings/agent-settings.functions"
import type { AgentSettings } from "@/common/features/agents/agent-settings/agent-settings.models"
import { buildDate } from "@/common/utils/build-date"

/**
 * Which settings version the playground runs new messages with.
 *
 * The draft is called out twice over — the trigger reads "v7 — Draft" and turns amber — because a
 * bare version number is not enough to stop someone demoing an unpublished agent to a client by
 * accident (issue #622).
 *
 * `versions` is the history list, newest first and already free of archived revisions: the history
 * endpoint omits them, so an archived version is never offered here.
 */
export function AgentSettingsVersionSelect({
  versions,
  revision,
  disabled,
  onRevisionChange,
}: {
  versions: AgentSettings[]
  revision: number | undefined
  disabled?: boolean
  onRevisionChange: (revision: number) => void
}) {
  const { t } = useTranslation()
  const publishedRevision = findPublishedVersion(versions)?.revision
  const selectedVersion = versions.find((version) => version.revision === revision)

  const buildVersionDetail = (version: AgentSettings) => {
    if (version.isDraft) return t("status:draft")
    if (version.revision === publishedRevision)
      return t("agentSettings:version.current", { date: buildDate(version.updatedAt) })
    return buildDate(version.updatedAt)
  }

  return (
    <Select
      value={revision !== undefined ? String(revision) : undefined}
      onValueChange={(value) => {
        const parsed = Number.parseInt(value, 10)
        if (!Number.isNaN(parsed)) onRevisionChange(parsed)
      }}
      disabled={disabled || versions.length === 0}
    >
      <SelectTrigger
        size="sm"
        aria-label={t("agentSettings:version.ariaLabel")}
        className={cn(
          "font-normal",
          selectedVersion?.isDraft && "border-amber-500 text-amber-700",
        )}
      >
        <SelectValue placeholder={t("agentSettings:version.placeholder")} />
      </SelectTrigger>
      <SelectContent>
        {versions.map((version) => (
          <SelectItem key={version.revision} value={String(version.revision)}>
            {t("agentSettings:version.item", {
              revision: version.revision,
              detail: buildVersionDetail(version),
            })}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

- [ ] **Step 4: Gate and commit**

The component has no test of its own; there is no React testing library set up in `apps/web` and the repo's convention is to cover presentational components through Storybook, which Task 6 does. Verification here is the type checker plus the linter.

```bash
cd /home/alexis_bayesimpact_org/bayes-platform && npm run biome:check && npm run typecheck
git add apps/web/src/studio/features/agents/agent-settings/components/AgentSettingsVersionSelect.tsx apps/web/src/common/features/agents/agent-settings/locales/
git commit -m "feat(playground): add the settings version select component"
```

---

### Task 6: Wire the picker into the playground

**Files:**
- Modify: `apps/web/src/studio/routes/StudioAgentSessionRoute.tsx`
- Modify: `apps/web/src/stories/seed.ts`
- Modify: `apps/web/src/stories/routes/studio/agent/AgentSessionRoute.stories.tsx`

**Interfaces:**
- Consumes: `selectPlaygroundRevision` and `agentSettingsActions.setPlaygroundRevision` (Task 2), `resolveMessageRevision(message, fallbackRevision)` (Task 4), `AgentSettingsVersionSelect` (Task 5).
- Produces: `seed.studio.playgroundRevision({ agentSessionId, revision })` for stories.

Note for the reviewer: the header loses its "open the version history" affordance, since the badge it replaces was clickable. The sheet is still reachable from every reply badge and from the editor's History button, so this is a deliberate trade, not an oversight.

- [ ] **Step 1: Add the story seed helper**

In `apps/web/src/stories/seed.ts`, inside the `studio` object right after `agentHistory`, add:

```ts
    playgroundRevision({
      agentSessionId,
      revision,
    }: {
      agentSessionId: string
      revision: number
    }): StoryPreloadedState {
      return {
        agentSettings: {
          playgroundRevisionBySessionId: { [agentSessionId]: revision },
        },
      }
    },
```

- [ ] **Step 2: Rewrite the route**

Replace `apps/web/src/studio/routes/StudioAgentSessionRoute.tsx` with:

```tsx
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import type { ConversationAgentSession } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.models"
import { selectConversationSubSessionsBySessionId } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.selectors"
import type { AgentSessionMessage } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/agent-session-messages.models"
import {
  selectCurrentMessagesData,
  selectStreaming,
} from "@/common/features/agents/agent-sessions/shared/agent-session-messages/agent-session-messages.selectors"
import { AgentSessionMessages } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/components/AgentSessionMessages"
import { findVersion, resolveMessageRevision } from "@/common/features/agents/agent-settings/agent-settings.functions"
import {
  selectAgentSettingsDataByAgentId,
  selectAgentSettingsHistoryDataByAgentId,
  selectPlaygroundRevision,
} from "@/common/features/agents/agent-settings/agent-settings.selectors"
import { agentSettingsActions } from "@/common/features/agents/agent-settings/agent-settings.slice"
import { selectCurrentAgentData } from "@/common/features/agents/agents.selectors"
import { getAgentIcon } from "@/common/features/agents/components/AgentIcon"
import { useAbility } from "@/common/hooks/use-ability"
import { useGetAgentRoute } from "@/common/hooks/use-get-path"
import { useValue } from "@/common/hooks/use-value"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { buildSince } from "@/common/utils/build-date"
import { AgentRevisionBadge } from "@/studio/features/agents/agent-settings/components/AgentRevisionBadge"
import { AgentSettingsVersionSelect } from "@/studio/features/agents/agent-settings/components/AgentSettingsVersionSelect"
import { AgentSessionActions } from "../features/agents/components/AgentSessionActions"

type AgentSession = ConversationAgentSession
export function StudioAgentSessionRoute({ agentSession }: { agentSession: AgentSession }) {
  const agent = useValue(selectCurrentAgentData)
  const publishedSettings = useValue(selectAgentSettingsDataByAgentId({ agentId: agent.id }))
  const messages = useValue(selectCurrentMessagesData)
  const selectSubSessions = useMemo(
    () => selectConversationSubSessionsBySessionId(agentSession.id),
    [agentSession.id],
  )
  const formSubSessions = useAppSelector(selectSubSessions)

  const { t } = useTranslation()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const agentRoute = useGetAgentRoute()

  const Icon = getAgentIcon(agent.type)

  const date = buildSince(agentSession.updatedAt)

  const handleBack = () => navigate(agentRoute)

  const { abilities } = useAbility()
  const canManageAgent = abilities.canManageAgent({ agentId: agent.id })

  const versions = useValue(
    selectAgentSettingsHistoryDataByAgentId({ agentId: agent.id, includeDraft: true }),
  )

  const selectPlayground = useMemo(
    () => selectPlaygroundRevision({ agentId: agent.id, agentSessionId: agentSession.id }),
    [agent.id, agentSession.id],
  )
  const runningRevision = useAppSelector(selectPlayground)
  const isStreaming = useAppSelector(selectStreaming)

  // The fillForm panel must describe the schema of the version being run, not of the published
  // one, or a draft that changed the form renders the wrong questions.
  const runningSettings =
    (runningRevision !== undefined ? findVersion(versions, runningRevision) : undefined) ??
    publishedSettings

  const renderMessageVersion = (message: AgentSessionMessage) => {
    if (!canManageAgent) return null
    const revision = resolveMessageRevision(message, runningRevision)
    if (revision === undefined) return null
    return (
      <AgentRevisionBadge
        agent={agent}
        revision={revision}
        versions={versions}
        tooltipKey="messageRevisionTooltip"
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      <GridHeader
        onBack={handleBack}
        title={t("agent:playground")}
        description={
          <div className="flex items-center gap-2 flex-wrap">
            <span className="capitalize-first">{agent.name}</span> •
            <span className="capitalize-first">{t(`agent:create.typeDialog.${agent.type}`)}</span>
            <Icon /> • {date}
            {canManageAgent && versions.length > 0 && (
              <>
                •
                <AgentSettingsVersionSelect
                  versions={versions}
                  revision={runningRevision}
                  disabled={isStreaming}
                  onRevisionChange={(revision) =>
                    dispatch(
                      agentSettingsActions.setPlaygroundRevision({
                        agentSessionId: agentSession.id,
                        revision,
                      }),
                    )
                  }
                />
              </>
            )}
          </div>
        }
        action={<AgentSessionActions agent={agent} agentSession={agentSession} />}
      />

      <div className="flex-1">
        <AgentSessionMessages
          session={agentSession}
          messages={messages}
          formSubSessions={formSubSessions}
          formResultSchema={
            runningSettings.fillFormEnabled ? runningSettings.outputJsonSchema : undefined
          }
          renderMessageVersion={renderMessageVersion}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update the stories**

In `apps/web/src/stories/routes/studio/agent/AgentSessionRoute.stories.tsx`:

Replace the `WithPendingDraft` doc comment and story, whose promise about the header is no longer true, and add a story that pins the published version:

```tsx
/** A draft exists, so the playground defaults to running it and the header select turns amber. */
export const WithPendingDraft: Story = {
  args: { withVersionHistory: true, withPendingDraft: true },
  decorators: Default.decorators,
}
```

Add a `pinnedRevision` arg so the "explicitly chose published while a draft exists" state is reachable. In `StoryArgs` add `pinnedRevision?: number`; in `argTypes` add `pinnedRevision: { control: "number" }`; in `args` add `pinnedRevision: undefined`; destructure it in the decorator alongside `withPendingDraft`; and append to the `mergeSeeds(…)` call:

```tsx
            pinnedRevision !== undefined
              ? seed.studio.playgroundRevision({
                  agentSessionId: session.id,
                  revision: pinnedRevision,
                })
              : {},
```

Then add the story:

```tsx
/** A draft exists but the tester pinned the published version, so nothing unpublished runs. */
export const WithPublishedPinned: Story = {
  args: { withVersionHistory: true, withPendingDraft: true, pinnedRevision: 2 },
  decorators: Default.decorators,
}
```

- [ ] **Step 4: Verify the whole web suite and the type checker**

```bash
cd /home/alexis_bayesimpact_org/bayes-platform && npm run biome:check && npm run typecheck
cd apps/web && npx vitest run
```

Expected: both green, all vitest files pass.

- [ ] **Step 5: Verify the stories render**

```bash
cd apps/web && npx storybook dev -p 6006 --no-open
```

Open `routes/studio/project/agent/session` and check, in order:
1. `Default` — header shows a version select reading `v2 — Current (…)`, not amber.
2. `WithPendingDraft` — the select reads `v3 — Draft` and is amber. Opening it lists v3, v2, v1.
3. `WithPublishedPinned` — the select reads `v2 — Current (…)`, not amber, even though v3 draft exists.
4. `NonManager` — no select at all.
5. `WithoutVersionHistory` — a single version listed, select present but with nothing to switch to.

Stop the server when done.

- [ ] **Step 6: Commit**

```bash
cd /home/alexis_bayesimpact_org/bayes-platform
git add apps/web/src/studio/routes/StudioAgentSessionRoute.tsx apps/web/src/stories/
git commit -m "feat(playground): choose which settings version the playground runs"
```

---

### Task 7: Full verification

**Files:** none modified unless a gate fails.

- [ ] **Step 1: API suite**

```bash
cd apps/api && npm run test:parallel
```

Expected: green. Per the repo's known flakiness, re-run any failing spec in isolation with `node --experimental-vm-modules ../../node_modules/jest/bin/jest.js --colors --runInBand --forceExit <path>` before treating it as a real failure.

- [ ] **Step 2: Boundaries**

```bash
cd apps/api && npm run check:boundaries
```

Expected: green. No new TypeORM relation was added, so no baseline regeneration should be needed. If it fails, stop and report rather than regenerating blindly.

- [ ] **Step 3: Root gates**

```bash
cd /home/alexis_bayesimpact_org/bayes-platform && npm run biome:check && npm run typecheck && npx turbo test
```

Expected: all green.

- [ ] **Step 4: Report**

State each command run and its actual result. Do not claim completion for a command that was not run.

---

## Known pre-existing issue, not addressed here

`StudioAgentSessionRoute` reads the settings history through `useValue`, which throws when the async data is not fulfilled. `StudioAgentRoute` only fetches that history when `canManageAgent` is true, so a Studio user without that ability would hit the throw rather than a hidden badge. Stories do not surface it because their decorator always seeds the history. This predates the version picker and is left alone deliberately: fixing it means deciding what a non-manager should see in the playground, which is its own question. Worth filing separately.
