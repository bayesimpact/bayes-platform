import { createChat, isFormTool } from "@caseai-connect/chat"
import {
  DeskConversationsRoutes,
  DeskDocumentsRoutes,
  TOOL_NAMES,
} from "@caseai-connect/desk-contracts"
import { invalidateAgentHistory } from "@/features/history"
import { invalidateMemories } from "@/features/memory"
import { apiRequest, apiStreamResponse, readServerSentEvents } from "@/lib/api-client"

/** The tools that change what the agent remembers about the person. */
const MEMORY_TOOLS: ReadonlySet<string> = new Set([TOOL_NAMES.saveMemory, TOOL_NAMES.forgetMemory])

/** The Desk's chat: its calls to the API, and what the Desk refreshes when the chat moves. */
export const chat = createChat({
  routes: { conversation: DeskConversationsRoutes, documents: DeskDocumentsRoutes },
  api: { apiRequest, apiStreamResponse, readServerSentEvents },
  onToolCalled(queryClient, conversation, toolName) {
    // A form the agent fills in shows its new answers while the reply goes on.
    if (isFormTool(toolName)) void invalidateAgentHistory(queryClient, conversation.agentId)
    // A fact the agent saves or forgets shows in its memory at once.
    if (MEMORY_TOOLS.has(toolName)) void invalidateMemories(queryClient, conversation.agentId)
  },
  onReplySettled(queryClient, conversation) {
    // The history gets the conversation's new title.
    void invalidateAgentHistory(queryClient, conversation.agentId)
  },
})
