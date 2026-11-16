import type { ReviewerSessionTranscriptMessageDto } from "@caseai-connect/api-contracts"
import { cn } from "@caseai-connect/ui/utils"
import { useTranslation } from "react-i18next"
import { MarkdownWrapper } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/components/MarkdownWrapper"

type Props = {
  messages: ReviewerSessionTranscriptMessageDto[]
}

export function ReviewerSessionTranscript({ messages }: Props) {
  const { t } = useTranslation()
  if (messages.length === 0) {
    return (
      <p className="text-muted-foreground p-4 text-sm italic">
        {t("reviewerCampaigns:transcript.empty")}
      </p>
    )
  }
  return (
    <ol className="flex flex-col gap-3">
      {messages.map((message) => (
        <li
          key={message.id}
          className={cn(
            "flex flex-col gap-1 rounded-md border p-3",
            message.role === "user" ? "bg-accent/40" : "bg-card",
          )}
        >
          <span className="text-muted-foreground text-xs uppercase tracking-wide">
            {message.role}
          </span>
          {/* Same rendering as the chat, so reviewers judge what testers saw: markdown for the
              agent's replies, plain text for what the tester typed. */}
          {message.role === "assistant" ? (
            <div className="text-sm">
              <MarkdownWrapper content={message.content} />
            </div>
          ) : (
            <p className="whitespace-pre-wrap text-sm">{message.content}</p>
          )}
        </li>
      ))}
    </ol>
  )
}
