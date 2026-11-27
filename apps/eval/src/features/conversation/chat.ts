import { createChat, isFormTool } from "@caseai-connect/chat"
import { EvalConversationsRoutes, EvalDocumentsRoutes } from "@caseai-connect/eval-contracts"
import { apiRequest, apiStreamResponse, readServerSentEvents } from "@/lib/api-client"
import { invalidateTesterSession } from "@/lib/tester-session-keys"

/** Evaluation's chat: its calls to the API, and what the app refreshes when the chat moves. */
export const chat = createChat({
  routes: { conversation: EvalConversationsRoutes, documents: EvalDocumentsRoutes },
  api: { apiRequest, apiStreamResponse, readServerSentEvents },
  onToolCalled(queryClient, conversation, toolName) {
    // A form the agent fills in shows its new answers while the reply goes on.
    if (isFormTool(toolName)) invalidateTesterSession(queryClient, conversation.agentSessionId)
  },
  onReplySettled(queryClient, conversation) {
    // A form may have changed in the last tool call of the reply.
    invalidateTesterSession(queryClient, conversation.agentSessionId)
  },
})
