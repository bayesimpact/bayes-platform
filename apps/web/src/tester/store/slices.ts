import { conversationAgentSessionsMiddleware } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.middleware"
import { conversationAgentSessionsSlice } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.slice"
import { agentSessionMessagesSlice } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/agent-session-messages.slice"
import { baseAgentSessionsMiddleware } from "@/common/features/agents/agent-sessions/shared/base-agent-session/base-agent-sessions.middleware"
import { agentsSlice } from "@/common/features/agents/agents.slice"
import { projectsSlice } from "@/common/features/projects/projects.slice"
import { createSliceManager } from "@/common/store/dynamic-middleware"
import { reviewCampaignsTesterMiddleware } from "../features/review-campaigns/tester.middleware"
import { reviewCampaignsTesterSlice } from "../features/review-campaigns/tester.slice"
import { currentIdsSlice } from "./currentIds.slice"

const testerMiddlewareList = [
  baseAgentSessionsMiddleware,
  conversationAgentSessionsMiddleware,
  reviewCampaignsTesterMiddleware,
]

export const testerSliceList = [
  agentSessionMessagesSlice,
  agentsSlice,
  conversationAgentSessionsSlice,
  currentIdsSlice,
  reviewCampaignsTesterSlice,
  projectsSlice,
]

export const { injectSlices: injectTesterSlices, resetSlices: resetTesterSlices } =
  createSliceManager({
    middlewares: testerMiddlewareList,
    slices: testerSliceList,
  })
