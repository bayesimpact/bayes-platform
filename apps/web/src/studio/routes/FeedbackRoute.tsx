import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import type { Agent } from "@/common/features/agents/agents.models"
import {
  selectCurrentAgentData,
  selectCurrentAgentId,
} from "@/common/features/agents/agents.selectors"
import { getAgentIcon } from "@/common/features/agents/components/AgentIcon"
import { useAbility } from "@/common/hooks/use-ability"
import { useGetPath } from "@/common/hooks/use-build-path"
import { NotFoundRoute } from "@/common/routes/NotFoundRoute"
import { useAppSelector } from "@/common/store/hooks"
import type { AgentMessageFeedback } from "@/studio/features/agent-message-feedback/agent-message-feedback.models"
import { selectFeedbacksFromAgentId } from "@/studio/features/agent-message-feedback/agent-message-feedback.selectors"
import { AsyncRoute } from "../../common/routes/AsyncRoute"
import { ErrorRoute } from "../../common/routes/ErrorRoute"
import { EmptyFeedback } from "../features/agent-message-feedback/components/EmptyFeedback"
import { FeedbackItem } from "../features/agent-message-feedback/components/FeedbackItem"

export function FeedbackRoute() {
  const agentId = useAppSelector(selectCurrentAgentId)
  const agent = useAppSelector(selectCurrentAgentData)
  const feedbacks = useAppSelector(selectFeedbacksFromAgentId(agentId))
  const { abilities } = useAbility()
  const canManageAgent = abilities.canManageAgent({ agentId: agentId })

  if (!agentId) return <ErrorRoute error="Missing valid agent ID" />

  if (!canManageAgent) return <NotFoundRoute />
  return (
    <AsyncRoute data={[agent, feedbacks]}>
      {([agentValue, feedbacksValue]) => <WithData agent={agentValue} feedbacks={feedbacksValue} />}
    </AsyncRoute>
  )
}

function WithData({ feedbacks, agent }: { feedbacks: AgentMessageFeedback[]; agent: Agent }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { getPath } = useGetPath()

  const handleBack = () => {
    const path = getPath("agent")
    navigate(path)
  }

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
              <FeedbackItem key={feedback.id} feedback={feedback} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
