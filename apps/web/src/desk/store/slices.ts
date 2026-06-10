import { conversationAgentSessionsMiddleware } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.middleware"
import { conversationAgentSessionsSlice } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.slice"
import { extractionAgentSessionsMiddleware } from "@/common/features/agents/agent-sessions/extraction/extraction-agent-sessions.middleware"
import { extractionAgentSessionsSlice } from "@/common/features/agents/agent-sessions/extraction/extraction-agent-sessions.slice"
import { formAgentSessionsMiddleware } from "@/common/features/agents/agent-sessions/form/form-agent-sessions.middleware"
import { formAgentSessionsSlice } from "@/common/features/agents/agent-sessions/form/form-agent-sessions.slice"
import { agentSessionMessagesSlice } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/agent-session-messages.slice"
import { baseAgentSessionsMiddleware } from "@/common/features/agents/agent-sessions/shared/base-agent-session/base-agent-sessions.middleware"
import { agentsMiddleware } from "@/common/features/agents/agents.middleware"
import { agentsSlice } from "@/common/features/agents/agents.slice"
import { agentCsvExtractionRunsMiddleware } from "@/common/features/agents/csv-extraction-runs/agent-csv-extraction-runs.middleware"
import { agentCsvExtractionRunsSlice } from "@/common/features/agents/csv-extraction-runs/agent-csv-extraction-runs.slice"
import { projectsSlice } from "@/common/features/projects/projects.slice"
import { createSliceManager } from "@/common/store/dynamic-middleware"
import { currentIdsSlice } from "./currentIds.slice"

const deskMiddlewareList = [
  agentCsvExtractionRunsMiddleware,
  agentsMiddleware,
  baseAgentSessionsMiddleware,
  conversationAgentSessionsMiddleware,
  extractionAgentSessionsMiddleware,
  formAgentSessionsMiddleware,
]

export const deskSliceList = [
  agentCsvExtractionRunsSlice,
  agentSessionMessagesSlice,
  agentsSlice,
  conversationAgentSessionsSlice,
  currentIdsSlice,
  extractionAgentSessionsSlice,
  formAgentSessionsSlice,
  projectsSlice,
]

export const { injectSlices: injectDeskSlices, resetSlices: resetDeskSlices } = createSliceManager({
  middlewares: deskMiddlewareList,
  slices: deskSliceList,
})
