import { Badge } from "@caseai-connect/ui/shad/badge"
import { cn } from "@caseai-connect/ui/utils"
import { useTranslation } from "react-i18next"
import { MarkdownWrapper } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/components/MarkdownWrapper"
import { buildDate } from "@/common/utils/build-date"
import type { ConversationReview } from "../conversation-review.models"

/** Read-only transcript: no feedback, no resend, no MCP App cards. */
export function ConversationReviewTranscript({ review }: { review: ConversationReview }) {
  const { t } = useTranslation("conversationReview")
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold">{review.title ?? review.sessionId}</h3>
          <Badge variant="secondary">{t(`session.${review.type}`)}</Badge>
          {review.isSubSession && <Badge variant="outline">{t("session.subSession")}</Badge>}
          {review.isPurged && <Badge variant="warning">{t("session.purged")}</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">
          {review.sessionId} · {t("session.startedAt", { date: buildDate(review.createdAt) })}
        </p>
      </div>

      {review.messages.length === 0 ? (
        <p className="text-sm italic text-muted-foreground">{t("session.noMessages")}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {review.messages.map((message) => (
            <li
              key={message.id}
              className={cn(
                "flex flex-col gap-1 rounded-md border p-3",
                message.role === "user" ? "bg-accent/40" : "bg-card",
              )}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium uppercase tracking-wide">
                  {t(`roles.${message.role}`)}
                </span>
                <span>{buildDate(message.createdAt)}</span>
                {message.status && message.status !== "completed" && (
                  <Badge variant="warning">{t(`status.${message.status}`)}</Badge>
                )}
              </div>
              <div className="text-sm">
                <MarkdownWrapper content={message.content} />
              </div>
              {message.toolNames.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t("tools", { names: message.toolNames.join(", ") })}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
