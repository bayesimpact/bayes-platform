import { beforeEach, describe, expect, it, vi } from "vitest"
import { agentFactory } from "@/common/features/agents/agent.factory"
import type { ConversationAgentSession } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.models"
import { agentSettingsFactory } from "@/common/features/agents/agent-settings/agent-settings.factory"
import { organizationFactory } from "@/common/features/organizations/organization.factory"
import { projectFactory } from "@/common/features/projects/projects.factory"
import type { RootState } from "@/common/store"
import { ADS, defaultAsyncData } from "@/common/store/async-data-status"
import type { Services } from "@/di/services"
import { listMessages, sendMessage } from "./agent-session-messages.thunks"
import { streamChatResponse } from "./external/agent-session-messages-streaming"

// The real module imports the OIDC client transitively, which needs `window`.
vi.mock("./external/agent-session-messages-streaming", () => ({ streamChatResponse: vi.fn() }))

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

  it("fails the turn when the attachment upload is refused", async () => {
    // The upload ran before the stream's error handling, so a refused one used to fail silently.
    const dispatch = vi.fn()
    const uploadAttachmentDocument = vi
      .fn()
      .mockRejectedValue(new Error("Request failed with status code 403"))
    const uploadExtra = {
      services: { agentSessionMessages: { uploadAttachmentDocument } } as unknown as Services,
    }

    const agentSession = {
      id: agentSessionId,
      type: "live",
      agentId,
    } as ConversationAgentSession
    const file = new File(["Sample content"], "notes.txt", { type: "text/plain" })

    const result = await sendMessage({ content: "Hello", agentSession, file })(
      dispatch,
      () => buildState(),
      uploadExtra,
    )

    expect(sendMessage.rejected.match(result)).toBe(true)
    expect(mockedStreamChatResponse).not.toHaveBeenCalled()
    const startStreaming = findAction(dispatch, "startStreaming")
    expect(startStreaming?.payload).toMatchObject({ userMessage: { content: "Hello" } })
    expect(startStreaming?.payload.userMessage).not.toHaveProperty("attachmentDocumentId")
    expect(findAction(dispatch, "failAssistantMessage")?.payload).toEqual({
      messageId: startStreaming?.payload.assistantMessageId,
      error: "Request failed with status code 403",
    })
  })

  it("fails the sub-agent's reply when the stream ends after a hand-over without settling it", async () => {
    // The parent's `end` settles the parent's reply only. The sub-agent's reply that follows
    // used to stay streaming for good when the stream closed before its own terminal event.
    mockedIsStudioInterface.mockReturnValue(true)
    mockedStreamChatResponse.mockImplementation(async ({ handlers }) => {
      handlers.onStart({ type: "start", messageId: "parent-reply" })
      handlers.onEnd({ type: "end", messageId: "parent-reply", fullContent: "Handing over" })
      handlers.onStart({ type: "start", messageId: "child-reply" })
    })
    const dispatch = vi.fn()

    const agentSession = {
      id: agentSessionId,
      type: "playground",
      agentId,
    } as ConversationAgentSession

    await sendMessage({ content: "Hello", agentSession })(dispatch, () => buildState(), extra)

    expect(findAction(dispatch, "failAssistantMessage")?.payload).toEqual({
      messageId: "child-reply",
      error: "The response ended unexpectedly",
    })
  })

  it("leaves a completed stream alone", async () => {
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

describe("listMessages", () => {
  const listWith = async () => {
    const getAll = vi.fn().mockResolvedValue([])
    const services = { agentSessionMessages: { getAll } } as unknown as Services
    await listMessages(agentSessionId)(vi.fn(), () => buildState(), { services })
    return getAll.mock.calls[0]?.[0]
  }

  it("reads the conversation of the session it is given, in the current scope", async () => {
    expect(await listWith()).toEqual({ organizationId, projectId, agentId, agentSessionId })
  })
})
