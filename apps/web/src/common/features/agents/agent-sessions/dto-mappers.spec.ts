import type {
  AgentSessionMessageDto,
  ConversationAgentSessionDto,
} from "@caseai-connect/api-contracts"
import { describe, expect, it } from "vitest"
import { fromDto as fromSessionDto } from "./conversation/external/conversation-agent-sessions.mappers"
import { fromDto as fromMessageDto } from "./shared/agent-session-messages/external/agent-session-messages.mappers"

/**
 * The models are the DTOs; the mappers copy field by field. A field added to a
 * DTO and forgotten here silently never reaches the screen (it happened with
 * the message agent and the session active agent), so both mappers must return
 * every field of a fully populated DTO.
 */
describe("DTO mappers", () => {
  it("copies every field of a conversation session", () => {
    const dto: Required<ConversationAgentSessionDto> = {
      id: "session-1",
      agentId: "agent-1",
      type: "live",
      title: "Title",
      createdAt: 1,
      updatedAt: 2,
      traceUrl: "https://trace",
      forms: [
        {
          agentId: "agent-2",
          agentSettingsId: "settings-2",
          status: "concluded",
          state: { name: "Doe" },
          summary: "Done",
          outputJsonSchema: { type: "object", properties: {} },
          updatedAt: 3,
        },
      ],
      activeAgentId: "agent-2",
    }
    expect(fromSessionDto(dto)).toEqual(expect.objectContaining(dto))
  })

  it("copies every field of a message", () => {
    const dto: Required<AgentSessionMessageDto> = {
      id: "message-1",
      role: "assistant",
      content: "Hello",
      attachmentDocumentId: "attachment-1",
      status: "completed",
      createdAt: 1,
      startedAt: 2,
      completedAt: 3,
      agentRevision: 4,
      agentId: "agent-2",
      toolCalls: [{ id: "call-1", name: "fillForm", arguments: { name: "Doe" } }],
    }
    expect(fromMessageDto(dto)).toEqual(expect.objectContaining(dto))
  })
})
