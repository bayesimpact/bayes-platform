import { Item, ItemContent, ItemFooter, ItemHeader, ItemTitle } from "@caseai-connect/ui/shad/item"
import { useTranslation } from "react-i18next"
import { MarkdownWrapper } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/components/MarkdownWrapper"
import { buildDate } from "@/common/utils/build-date"
import { TraceUrlOpener } from "@/studio/components/TraceUrlOpener"
import type { AgentMessageFeedback } from "@/studio/features/agent-message-feedback/agent-message-feedback.models"

export function FeedbackItem({ feedback }: { feedback: AgentMessageFeedback }) {
  const { t } = useTranslation("agentMessageFeedback")
  const { agentSessionId, agentMessageId } = feedback
  const creationDate = buildDate(feedback.createdAt)
  return (
    <div className="py-6 flex flex-col gap-4">
      <Item variant="outline">
        <ItemContent className="text-sm">
          <MarkdownWrapper content={feedback.agentMessageContent} />
          <div className="flex gap-2 text-xs text-muted-foreground mt-2">
            <div>
              {t("agentMessageFeedback.props.sessionId")} {agentSessionId}
            </div>
            <div>
              {t("agentMessageFeedback.props.messageId")} {agentMessageId}
            </div>
          </div>
        </ItemContent>
      </Item>

      <Item variant="muted">
        <ItemHeader>
          <ItemTitle className="text-muted-foreground">{creationDate}</ItemTitle>
        </ItemHeader>
        <ItemContent className="text-base">{feedback.content}</ItemContent>
        <ItemFooter>
          <TraceUrlOpener
            traceUrl={feedback.traceUrl}
            buttonProps={{ size: "sm", className: "w-fit" }}
          />
        </ItemFooter>
      </Item>
    </div>
  )
}
