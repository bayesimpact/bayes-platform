import { beforeEach, describe, expect, it, vi } from "vitest"
import { agentFactory } from "@/common/features/agents/agent.factory"
import type { ConversationAgentSession } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.models"
import { agentSettingsFactory } from "@/common/features/agents/agent-settings/agent-settings.factory"
import { organizationFactory } from "@/common/features/organizations/organization.factory"
import { projectFactory } from "@/common/features/projects/projects.factory"
import type { RootState } from "@/common/store"
import { ADS, defaultAsyncData } from "@/common/store/async-data-status"
import type { Services } from "@/di/services"
import { isStudioInterface } from "@/studio/routes/helpers"
import { sendMessage } from "./agent-session-messages.thunks"
import { streamChatResponse } from "./external/agent-session-messages-streaming"

// `isStudioInterface` reads `window.location`, which doesn't exist under vitest's default node
// environment. Mocking it (rather than `buildType` itself) keeps the real `buildType` — the
// gate `sendMessage` actually depends on — in the test path.
vi.mock("@/studio/routes/helpers", () => ({ isStudioInterface: vi.fn() }))

// The real module imports the Auth0 client transitively, which also needs `window`.
vi.mock("./external/agent-session-messages-streaming", () => ({ streamChatResponse: vi.fn() }))

const mockedIsStudioInterface = vi.mocked(isStudioInterface)
const mockedStreamChatResponse = vi.mocked(streamChatResponse)

const organizationId = "org-1"
const projectId = "project-1"
const agentId = "agent-1"
const agentSessionId = "session-1"

const organization = organizationFactory.build({ id: organizationId })
const project = projectFactory.transient({ organization }).build({ id: projectId })
const agent = agentFactory.transient({ project }).build({ id: agentId })

const extra = { services: {} as Services }

type SliceAction = { type: string; payload: Record<string, unknown> }

const isSliceAction = (value: unknown): value is SliceAction =>
  typeof value === "object" && value !== null && "type" in value && "payload" in value

/** The `agentSessionMessages/<name>` action the thunk dispatched, if it dispatched one. */
const findAction = (dispatch: ReturnType<typeof vi.fn>, name: string): SliceAction | undefined =>
  dispatch.mock.calls
    .map(([action]: unknown[]) => action)
    .filter(isSliceAction)
    .find((action) => action.type === `agentSessionMessages/${name}`)

/**
 * A fixture shaped like only the slices `sendMessage` reads, not a full `RootState` — the real
 * type is a many-scope union not meant to be hand-built. The cast is safe because every field the
 * thunk touches is present with the real shape.
 */
function buildState({
  history = {},
  chosenRevision,
}: {
  history?: Record<string, ReturnType<typeof agentSettingsFactory.build>[]>
  chosenRevision?: number
} = {}): RootState {
  return {
    currentIds: { organizationId, projectId, agentId, agentSessionId },
    agentSessionMessages: { data: defaultAsyncData },
    agentSettings: {
      history: Object.fromEntries(
        Object.entries(history).map(([historyAgentId, versions]) => [
          historyAgentId,
          { status: ADS.Fulfilled, error: null, value: versions },
        ]),
      ),
      playgroundRevisionByAgentId:
        chosenRevision === undefined ? {} : { [agentId]: chosenRevision },
    },
  } as unknown as RootState
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedStreamChatResponse.mockResolvedValue(undefined)
})

describe("sendMessage", () => {
  it("carries the chosen revision on a playground session", async () => {
    mockedIsStudioInterface.mockReturnValue(true)
    const versions = [agentSettingsFactory.transient({ agent }).build({ revision: 2 })]
    const state = buildState({ history: { [agentId]: versions }, chosenRevision: 2 })
    const dispatch = vi.fn()

    const agentSession = {
      id: agentSessionId,
      type: "playground",
      agentId,
    } as ConversationAgentSession

    await sendMessage({ content: "Hello", agentSession })(dispatch, () => state, extra)

    expect(mockedStreamChatResponse).toHaveBeenCalledWith(
      expect.objectContaining({ agentSettingsRevision: 2 }),
    )
  })

  it("forwards no revision on a live session even when one is chosen", async () => {
    mockedIsStudioInterface.mockReturnValue(false)
    const versions = [agentSettingsFactory.transient({ agent }).build({ revision: 2 })]
    const state = buildState({ history: { [agentId]: versions }, chosenRevision: 2 })
    const dispatch = vi.fn()

    const agentSession = {
      id: agentSessionId,
      type: "live",
      agentId,
    } as ConversationAgentSession

    await sendMessage({ content: "Hello", agentSession })(dispatch, () => state, extra)

    expect(mockedStreamChatResponse).toHaveBeenCalledWith(
      expect.objectContaining({ agentSettingsRevision: undefined }),
    )
  })

  it("forwards no revision on a playground session whose history has not loaded", async () => {
    mockedIsStudioInterface.mockReturnValue(true)
    const state = buildState()
    const dispatch = vi.fn()

    const agentSession = {
      id: agentSessionId,
      type: "playground",
      agentId,
    } as ConversationAgentSession

    await sendMessage({ content: "Hello", agentSession })(dispatch, () => state, extra)

    expect(mockedStreamChatResponse).toHaveBeenCalledWith(
      expect.objectContaining({ agentSettingsRevision: undefined }),
    )
  })

  it("records the sent revision on the optimistic assistant message", async () => {
    // The badge must name the version the request carried, not whatever the picker shows later.
    mockedIsStudioInterface.mockReturnValue(true)
    const versions = [agentSettingsFactory.transient({ agent }).build({ revision: 2 })]
    const state = buildState({ history: { [agentId]: versions }, chosenRevision: 2 })
    const dispatch = vi.fn()

    const agentSession = {
      id: agentSessionId,
      type: "playground",
      agentId,
    } as ConversationAgentSession

    await sendMessage({ content: "Hello", agentSession })(dispatch, () => state, extra)

    expect(findAction(dispatch, "startStreaming")?.payload).toMatchObject({ agentRevision: 2 })
  })

  it("fails the assistant message when the stream ends with no terminal event", async () => {
    // A truncated stream used to leave the bubble streaming for good, which blocked every later
    // send and disabled the version picker until the page was reloaded.
    mockedIsStudioInterface.mockReturnValue(true)
    const dispatch = vi.fn()

    const agentSession = {
      id: agentSessionId,
      type: "playground",
      agentId,
    } as ConversationAgentSession

    await sendMessage({ content: "Hello", agentSession })(dispatch, () => buildState(), extra)

    const startStreaming = findAction(dispatch, "startStreaming")
    expect(findAction(dispatch, "failAssistantMessage")?.payload).toEqual({
      messageId: startStreaming?.payload.assistantMessageId,
      error: "The response ended unexpectedly",
    })
  })

  it("resends with the original attachment instead of uploading again", async () => {
    // Resending an interrupted turn reuses the document the user already attached to it.
    mockedIsStudioInterface.mockReturnValue(false)
    const dispatch = vi.fn()

    const agentSession = {
      id: agentSessionId,
      type: "live",
      agentId,
    } as ConversationAgentSession

    await sendMessage({ content: "Hello", agentSession, attachmentDocumentId: "attachment-1" })(
      dispatch,
      () => buildState(),
      extra,
    )

    expect(mockedStreamChatResponse).toHaveBeenCalledWith(
      expect.objectContaining({ attachmentDocumentId: "attachment-1" }),
    )
    expect(findAction(dispatch, "startStreaming")?.payload).toMatchObject({
      userMessage: expect.objectContaining({ attachmentDocumentId: "attachment-1" }),
    })
  })

  it("leaves a completed stream alone", async () => {
    mockedIsStudioInterface.mockReturnValue(true)
    mockedStreamChatResponse.mockImplementation(async ({ handlers }) => {
      handlers.onEnd({ type: "end", messageId: "persisted-1", fullContent: "Hello" })
    })
    const dispatch = vi.fn()

    const agentSession = {
      id: agentSessionId,
      type: "playground",
      agentId,
    } as ConversationAgentSession

    await sendMessage({ content: "Hello", agentSession })(dispatch, () => buildState(), extra)

    expect(findAction(dispatch, "failAssistantMessage")).toBeUndefined()
    expect(findAction(dispatch, "completeAssistantMessage")).toBeDefined()
  })
})
