import type { ConversationReviewLookupDto } from "@caseai-connect/api-contracts"
import { Alert, AlertDescription } from "@caseai-connect/ui/shad/alert"
import { Spinner } from "@caseai-connect/ui/shad/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@caseai-connect/ui/shad/tabs"
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
import { ReviewSessionsByCategory } from "@/studio/features/conversation-review/components/ReviewSessionsByCategory"
import type { ConversationReviewTab } from "@/studio/features/conversation-review/conversation-review.models"
import {
  selectConversationReview,
  selectConversationReviewTab,
} from "@/studio/features/conversation-review/conversation-review.selectors"
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
  const reviewTab = useAppSelector(selectConversationReviewTab)

  const handleSubmit = ({ agentSessionId }: ConversationReviewLookupDto) => {
    void dispatch(loadConversationReview({ agentSessionId }))
  }

  const handleTabChange = (value: string) => {
    dispatch(conversationReviewActions.setReviewTab(value as ConversationReviewTab))
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
        {/* Left: the lookup form or the by-category list. Right: the session opened,
            with its own scroll, so the list stays in view while reading. */}
        <div className="flex flex-col items-start gap-6 xl:flex-row">
          <div className="w-full min-w-0 flex-1">
            <Tabs value={reviewTab} onValueChange={handleTabChange}>
              <TabsList>
                <TabsTrigger value="session-id">
                  {t("conversationReview:tabs.sessionId")}
                </TabsTrigger>
                <TabsTrigger value="by-category">
                  {t("conversationReview:tabs.byCategory")}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="session-id">
                <ConversationReviewLookupForm onSubmit={handleSubmit} />
              </TabsContent>
              <TabsContent value="by-category">
                <ReviewSessionsByCategory />
              </TabsContent>
            </Tabs>
          </div>
          <ReviewPanel />
        </div>
      </div>
    </>
  )
}

/** The right panel: the session opened from the form or the by-category list, if any. */
function ReviewPanel() {
  const { t } = useTranslation("conversationReview")
  const review = useAppSelector(selectConversationReview)
  return (
    <aside className="w-full shrink-0 rounded-lg border xl:w-[440px]">
      <div className="max-h-[70vh] overflow-y-auto p-4">
        {ADS.isLoading(review) && <Spinner />}
        {ADS.isError(review) && <p className="text-sm text-destructive">{t("notFound")}</p>}
        {ADS.isFulfilled(review) && <ConversationReviewTranscript review={review.value} />}
        {!ADS.isLoading(review) && !ADS.isError(review) && !ADS.isFulfilled(review) && (
          <p className="text-sm italic text-muted-foreground">{t("empty")}</p>
        )}
      </div>
    </aside>
  )
}
