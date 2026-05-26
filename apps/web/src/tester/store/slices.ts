import { conversationAgentSessionsSlice } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.slice"
import { formAgentSessionsSlice } from "@/common/features/agents/agent-sessions/form/form-agent-sessions.slice"
import { agentSessionMessagesMiddleware } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/agent-session-messages.middleware"
import { agentSessionMessagesSlice } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/agent-session-messages.slice"
import { agentsSlice } from "@/common/features/agents/agents.slice"
import { projectsMiddleware } from "@/common/features/projects/projects.middleware"
import { projectsSlice } from "@/common/features/projects/projects.slice"
import { createSliceManager } from "@/common/store/dynamic-middleware"
import { reviewCampaignsTesterMiddleware } from "../features/review-campaigns/tester.middleware"
import { reviewCampaignsTesterSlice } from "../features/review-campaigns/tester.slice"
import { currentIdsSlice } from "./currentIds.slice"

const testerMiddlewareList = [
  agentSessionMessagesMiddleware,
  reviewCampaignsTesterMiddleware,
  projectsMiddleware,
]

export const testerSliceList = [
  agentSessionMessagesSlice,
  agentsSlice,
  conversationAgentSessionsSlice,
  currentIdsSlice,
  formAgentSessionsSlice,
  reviewCampaignsTesterSlice,
  projectsSlice,
]

export const { injectSlices: injectTesterSlices, resetSlices: resetTesterSlices } =
  createSliceManager({
    middlewares: testerMiddlewareList,
    slices: testerSliceList,
  })
