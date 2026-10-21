import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import {
  selectCurrentAgentData,
  selectCurrentAgentId,
} from "@/common/features/agents/agents.selectors"
import { getAgentIcon } from "@/common/features/agents/components/AgentIcon"
import { selectCanReviewConversationsOfAgent, selectMe } from "@/common/features/me/me.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useAbility } from "@/common/hooks/use-ability"
import { useGetAgentRoute } from "@/common/hooks/use-get-path"
import { useMount } from "@/common/hooks/use-mount"
import { useCurrentId, useValue } from "@/common/hooks/use-value"
import { useAppSelector } from "@/common/store/hooks"
import { evaluationConversationDatasetsActions } from "@/eval/features/evaluation-conversation-datasets/evaluation-conversation-datasets.slice"
import { selectCurrentAgentFeedbacksData } from "@/studio/features/agent-message-feedback/agent-message-feedback.selectors"
import { SaveAsTestCase } from "@/studio/features/test-cases/components/SaveAsTestCase"
import { AsyncRoute } from "../../common/routes/AsyncRoute"
import { ErrorRoute } from "../../common/routes/ErrorRoute"
import type { AgentMessageFeedback } from "../features/agent-message-feedback/agent-message-feedback.models"
import { agentMessageFeedbackActions } from "../features/agent-message-feedback/agent-message-feedback.slice"
import { EmptyFeedback } from "../features/agent-message-feedback/components/EmptyFeedback"
import { FeedbackItem } from "../features/agent-message-feedback/components/FeedbackItem"

export function FeedbackRoute() {
  const agentId = useCurrentId(selectCurrentAgentId)
  const feedbacks = useAppSelector(selectCurrentAgentFeedbacksData)
  const projectId = useAppSelector(selectCurrentProjectId)
  const { abilities } = useAbility()

  useMount({ actions: agentMessageFeedbackActions, refreshOn: [agentId] })
  // The datasets a reported answer can be saved into as a test case. Left out of the AsyncRoute:
  // the feedback list does not wait for them.
  useMount({
    actions: evaluationConversationDatasetsActions,
    condition: abilities.canSaveTestCase({ projectId }),
  })

  if (!agentId) return <ErrorRoute error="Missing valid agent ID" />
  return (
    <AsyncRoute data={[feedbacks]}>
      <WithData />
    </AsyncRoute>
  )
}

function WithData() {
  const agent = useValue(selectCurrentAgentData)
  const feedbacks = useValue(selectCurrentAgentFeedbacksData)
  const { t } = useTranslation()
  const navigate = useNavigate()
  const agentRoute = useGetAgentRoute()
  const me = useAppSelector(selectMe)
  const canReviewConversations = useAppSelector(selectCanReviewConversationsOfAgent(agent.id))
  // Saving a test case reads the conversation behind the answer: one's own, or any of the agent's
  // for a safety reviewer. A report is usually left on the reporter's own conversation.
  const canReadConversation = (feedback: AgentMessageFeedback) =>
    canReviewConversations || feedback.userId === me?.value?.id

  const handleBack = () => navigate(agentRoute)

  const Icon = getAgentIcon(agent.type)
  return (
    <>
      <GridHeader
        onBack={handleBack}
        title={t("agentMessageFeedback:feedback")}
        description={
          <>
            <div className="capitalize-first">{agent.name}</div> •
            <div className="capitalize-first">{t(`agent:create.typeDialog.${agent.type}`)}</div>
            <Icon />
          </>
        }
      />
      <div className="px-6 bg-white">
        {feedbacks.length === 0 ? (
          <EmptyFeedback agent={agent} />
        ) : (
          <div className="grid grid-cols-1 divide-y-4 divide-muted">
            {feedbacks.map((feedback) => (
              <FeedbackItem
                key={feedback.id}
                feedback={feedback}
                actions={
                  canReadConversation(feedback) && (
                    <SaveAsTestCase
                      withLabel
                      source={{
                        agentMessageId: feedback.agentMessageId,
                        answer: feedback.agentMessageContent,
                        feedback: feedback.content,
                      }}
                    />
                  )
                }
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
