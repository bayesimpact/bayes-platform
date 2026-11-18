import type {
  ReviewCampaignParamsDto,
  TesterSessionOutputDto,
} from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { CheckCircle2Icon, CircleDashedIcon, MessageSquareIcon, Trash2Icon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { fullDateTimeOf } from "@/lib/format-time"

export type TesterSessionRowProps = {
  campaign: ReviewCampaignParamsDto
  session: TesterSessionOutputDto
  onGiveFeedback: (session: TesterSessionOutputDto) => void
  onDelete: (session: TesterSessionOutputDto) => void
}

/**
 * One of the tester's sessions: when it started, whether they gave their feedback, and what they
 * can still do with it. A session with feedback is over: it opens, and nothing else.
 */
export function TesterSessionRow({
  campaign,
  session,
  onGiveFeedback,
  onDelete,
}: TesterSessionRowProps) {
  const { t, i18n } = useLingui()
  const started = fullDateTimeOf(session.createdAt, i18n.locale)
  const isPending = session.feedbackStatus === "pending"
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
      <MessageSquareIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">{started}</span>
      {isPending ? (
        <Badge variant="outline">
          <CircleDashedIcon aria-hidden />
          <Trans>Feedback to give</Trans>
        </Badge>
      ) : (
        <Badge variant="secondary">
          <CheckCircle2Icon aria-hidden />
          <Trans>Feedback given</Trans>
        </Badge>
      )}
      <div className="flex items-center gap-2">
        {isPending ? (
          <Button
            variant="outline"
            size="sm"
            aria-label={t`Give feedback on the session of ${started}`}
            onClick={() => onGiveFeedback(session)}
          >
            <Trans>Give feedback</Trans>
          </Button>
        ) : null}
        <Link
          to="/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/test/sessions/$sessionId"
          params={{ ...campaign, sessionId: session.id }}
          aria-label={t`Open the session of ${started}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <Trans comment="Opens a session with the agent">Open</Trans>
        </Link>
        {isPending ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t`Delete the session of ${started}`}
            onClick={() => onDelete(session)}
          >
            <Trash2Icon aria-hidden />
          </Button>
        ) : null}
      </div>
    </li>
  )
}
