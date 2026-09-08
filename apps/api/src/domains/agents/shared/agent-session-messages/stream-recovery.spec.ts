import type { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { organizationFactory } from "@/domains/organizations/organization.factory"
import { projectFactory } from "@/domains/projects/project.factory"
import { userFactory } from "@/domains/users/user.factory"
import { agentFactory } from "../../agent.factory"
import { conversationAgentSessionFactory } from "../../conversation-agent-sessions/conversation-agent-session.factory"
import type { AgentMessage } from "./agent-message.entity"
import { agentMessageFactory } from "./agent-messages.factory"
import {
  isStreamStale,
  recoverAbortedStream,
  STREAM_HEARTBEAT_MS,
  STREAM_TIMEOUT_MS,
  throttleHeartbeat,
} from "./stream-recovery"

const organization = organizationFactory.build()
const project = projectFactory.transient({ organization }).build()
const user = userFactory.build()
const agent = agentFactory.transient({ organization, project }).build()
const agentSettings = agentSettingsFactory.transient({ organization, project, agent }).build()
const session = conversationAgentSessionFactory
  .transient({ organization, project, user, agent })
  .build()
const connectScope: RequiredConnectScope = {
  organizationId: organization.id,
  projectId: project.id,
}

const now = Date.UTC(2026, 8, 4, 12, 0, 0)
const minutesAgo = (minutes: number) => new Date(now - minutes * 60 * 1000)

const streamingMessage = (overrides: Partial<AgentMessage> = {}): AgentMessage =>
  agentMessageFactory
    .assistant()
    .streaming()
    .transient({ organization, project, session, agentSettings })
    .build({ startedAt: minutesAgo(10), updatedAt: minutesAgo(10), ...overrides })

describe("isStreamStale", () => {
  it("is stale once nothing has been written for the whole window", () => {
    expect(isStreamStale(streamingMessage(), now)).toBe(true)
  })

  it("is live while the stream keeps touching the row, however long ago it started", () => {
    // A multi-tool turn can run well past the window; its tool persists and heartbeats keep
    // bumping `updatedAt`, which is what tells it apart from an orphaned row.
    expect(isStreamStale(streamingMessage({ updatedAt: minutesAgo(1) }), now)).toBe(false)
  })

  it("is live right at the window edge", () => {
    const edge = new Date(now - STREAM_TIMEOUT_MS)
    expect(isStreamStale(streamingMessage({ startedAt: edge, updatedAt: edge }), now)).toBe(false)
  })

  it("never flags a settled message", () => {
    expect(isStreamStale(streamingMessage({ status: "completed" }), now)).toBe(false)
    expect(isStreamStale(streamingMessage({ status: "aborted" }), now)).toBe(false)
  })

  it("never flags a message that has no start", () => {
    expect(isStreamStale(streamingMessage({ startedAt: null }), now)).toBe(false)
  })
})

describe("recoverAbortedStream", () => {
  // Staleness is judged against the clock here, so these fixtures are dated from it.
  const sentMinutesAgo = (minutes: number): AgentMessage =>
    agentMessageFactory
      .assistant()
      .streaming()
      .sentMinutesAgo(minutes)
      .transient({ organization, project, session, agentSettings })
      .build()

  const buildRepository = (affected: number) => {
    const updateManyBy = jest.fn().mockResolvedValue(affected)
    return {
      repository: { updateManyBy } as unknown as ConnectRepository<AgentMessage>,
      updateManyBy,
    }
  }

  it("settles a stale message as aborted", async () => {
    const { repository, updateManyBy } = buildRepository(1)
    const message = sentMinutesAgo(10)

    const recovered = await recoverAbortedStream({
      agentMessageConnectRepository: repository,
      connectScope,
      message,
    })

    expect(recovered.status).toBe("aborted")
    expect(updateManyBy).toHaveBeenCalledWith({
      connectScope,
      where: { id: message.id, status: "streaming" },
      fields: { status: "aborted" },
    })
  })

  it("leaves a message that completed between the read and the write alone", async () => {
    // The write is conditional on the row still streaming. When it matched nothing, the reply
    // has settled on its own since it was read, and that outcome must not be reported as
    // interrupted: the next poll returns the settled row.
    const { repository } = buildRepository(0)
    const message = sentMinutesAgo(10)

    const recovered = await recoverAbortedStream({
      agentMessageConnectRepository: repository,
      connectScope,
      message,
    })

    expect(recovered.status).toBe("streaming")
  })

  it("does not write for a message that may still be streaming", async () => {
    const { repository, updateManyBy } = buildRepository(1)

    const recovered = await recoverAbortedStream({
      agentMessageConnectRepository: repository,
      connectScope,
      message: sentMinutesAgo(1),
    })

    expect(recovered.status).toBe("streaming")
    expect(updateManyBy).not.toHaveBeenCalled()
  })
})

describe("throttleHeartbeat", () => {
  it("touches the row once per period however often progress is reported", () => {
    let clock = now
    const touch = jest.fn()
    const onProgress = throttleHeartbeat(touch, () => clock)

    onProgress()
    clock += STREAM_HEARTBEAT_MS / 2
    onProgress()
    expect(touch).not.toHaveBeenCalled()

    clock += STREAM_HEARTBEAT_MS / 2
    onProgress()
    onProgress()
    expect(touch).toHaveBeenCalledTimes(1)

    clock += STREAM_HEARTBEAT_MS
    onProgress()
    expect(touch).toHaveBeenCalledTimes(2)
  })

  it("does not touch the row while no progress is reported", () => {
    // A hung stream reports nothing, so the row goes untouched and settles as aborted once the
    // window has passed: that is what tells a hung turn from a long one.
    let clock = now
    const touch = jest.fn()
    throttleHeartbeat(touch, () => clock)

    clock += STREAM_TIMEOUT_MS * 2
    expect(touch).not.toHaveBeenCalled()
  })
})
