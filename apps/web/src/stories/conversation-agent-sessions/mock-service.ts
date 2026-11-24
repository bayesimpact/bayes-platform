import type {
  ConversationAgentSession,
  ConversationSubSession,
} from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.models"
import type { IConversationAgentSessionsSpi } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.spi"

/**
 * The conversation session API for route stories. The session route refetches the list on mount
 * and the sub-sessions on mount and after each streamed reply, so a story that seeds either one
 * has to answer the same records here: without that the fetch overwrites what it seeded.
 */
export function buildMockConversationAgentSessionsService({
  sessions = [],
  subSessions = [],
}: {
  sessions?: ConversationAgentSession[]
  subSessions?: ConversationSubSession[]
} = {}): IConversationAgentSessionsSpi {
  return {
    getAll: async () => sessions,
    listSubSessions: async () => subSessions,
    createOne: async () => {
      throw new Error("This story does not create a session")
    },
    deleteOne: async () => {
      throw new Error("This story does not delete a session")
    },
  }
}
