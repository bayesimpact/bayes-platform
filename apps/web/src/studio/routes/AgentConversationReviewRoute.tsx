import type { ConversationReviewLookupDto } from "@caseai-connect/api-contracts"
import { Alert, AlertDescription } from "@caseai-connect/ui/shad/alert"
import { Spinner } from "@caseai-connect/ui/shad/spinner"
import { ShieldAlertIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import {
  selectCurrentAgentData,
  selectCurrentAgentId,
} from "@/common/features/agents/agents.selectors"
import { getAgentIcon } from "@/common/features/agents/components/AgentIcon"
import { selectCanReviewConversationsOfAgent } from "@/common/features/me/me.selectors"
import { useGetAgentRoute } from "@/common/hooks/use-get-path"
import { useMount } from "@/common/hooks/use-mount"
import { useValue } from "@/common/hooks/use-value"
import { NotFoundRoute } from "@/common/routes/NotFoundRoute"
import { ADS } from "@/common/store/async-data-status"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { ConversationReviewLookupForm } from "@/studio/features/conversation-review/components/ConversationReviewLookupForm"
import { ConversationReviewTranscript } from "@/studio/features/conversation-review/components/ConversationReviewTranscript"
import { selectConversationReview } from "@/studio/features/conversation-review/conversation-review.selectors"
import { conversationReviewActions } from "@/studio/features/conversation-review/conversation-review.slice"
import { loadConversationReview } from "@/studio/features/conversation-review/conversation-review.thunks"

/** Safety review: open to the people granted it on this agent, whatever their role. */
export function AgentConversationReviewRoute() {
  const agentId = useAppSelector(selectCurrentAgentId)
  const canReviewConversations = useAppSelector(selectCanReviewConversationsOfAgent(agentId))

  useMount({ actions: conversationReviewActions, condition: canReviewConversations })

  if (!canReviewConversations) return <NotFoundRoute />
  return <WithPermission />
}

function WithPermission() {
  const agent = useValue(selectCurrentAgentData)
  const { t } = useTranslation()
  const navigate = useNavigate()
  const agentRoute = useGetAgentRoute()
  const dispatch = useAppDispatch()

  const handleSubmit = ({ agentSessionId }: ConversationReviewLookupDto) => {
    void dispatch(loadConversationReview({ agentSessionId }))
  }

  const Icon = getAgentIcon(agent.type)
  return (
    <>
      <GridHeader
        onBack={() => navigate(agentRoute)}
        title={t("conversationReview:pageTitle")}
        description={
          <>
            <div className="capitalize-first">{agent.name}</div> •
            <div className="capitalize-first">{t(`agent:create.typeDialog.${agent.type}`)}</div>
            <Icon />
          </>
        }
      />
      <div className="flex flex-col gap-6 p-6 bg-white">
        <Alert>
          <ShieldAlertIcon />
          <AlertDescription>{t("conversationReview:notice")}</AlertDescription>
        </Alert>
        <ConversationReviewLookupForm onSubmit={handleSubmit} />
        <ReviewResult />
      </div>
    </>
  )
}

function ReviewResult() {
  const { t } = useTranslation("conversationReview")
  const review = useAppSelector(selectConversationReview)
  if (ADS.isLoading(review)) return <Spinner />
  if (ADS.isError(review)) return <p className="text-sm text-destructive">{t("notFound")}</p>
  if (ADS.isFulfilled(review)) return <ConversationReviewTranscript review={review.value} />
  return <p className="text-sm italic text-muted-foreground">{t("empty")}</p>
}
