import type {
  ReviewCampaignParamsDto,
  TesterSessionOutputDto,
} from "@caseai-connect/eval-contracts"
import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"
import { Link } from "@tanstack/react-router"
import { type ColumnDef, createColumnHelper } from "@tanstack/react-table"
import { cn } from "cn"
import { CheckCircle2Icon, CircleDashedIcon, Trash2Icon } from "lucide-react"
import { TimeAgo } from "@/components/shared/TimeAgo"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { fullDateTimeOf } from "@/lib/format-time"

const columnHelper = createColumnHelper<TesterSessionOutputDto>()

/** The texts of the headers and cells, which the table translates. */
const testerSessionColumnLabels = {
  started: msg({ message: "Started", comment: "When a session started" }),
  feedback: msg({ message: "Feedback", comment: "Whether the tester gave feedback on a session" }),
  toGive: msg`Feedback to give`,
  given: msg`Feedback given`,
  giveFeedback: msg`Give feedback`,
  chat: msg({
    message: "Chat",
    comment: "Opens a session of a tester with the agent, where they can still talk to it",
  }),
  view: msg({
    message: "View",
    comment: "Opens a session of a tester that is over, only to read it",
  }),
} satisfies Record<string, MessageDescriptor>

/** What the rows' buttons are named, and what they do, by the session they act on. */
type TesterSessionActions = {
  giveFeedbackLabel: (started: string) => string
  /** The name of the link to a session the tester can still talk in. */
  chatLabel: (started: string) => string
  /** The name of the link to a session that is over, which only reads. */
  viewLabel: (started: string) => string
  deleteLabel: (started: string) => string
  onGiveFeedback: (session: TesterSessionOutputDto) => void
  onDelete: (session: TesterSessionOutputDto) => void
}

/**
 * The columns of the tester's sessions: when each started, whether they gave their feedback, and
 * what they can still do with it. A session that waits for its feedback opens on Chat; one with
 * feedback is over: it opens on View, to read it, and nothing else.
 */
export function testerSessionColumnsOf({
  campaign,
  locale,
  translate,
  actions,
}: {
  campaign: ReviewCampaignParamsDto
  locale: string
  translate: (descriptor: MessageDescriptor) => string
  actions: TesterSessionActions
}): ColumnDef<TesterSessionOutputDto, unknown>[] {
  return [
    columnHelper.accessor("createdAt", {
      header: translate(testerSessionColumnLabels.started),
      cell: (context) => <TimeAgo moment={context.getValue()} className="text-foreground" />,
    }) as ColumnDef<TesterSessionOutputDto, unknown>,
    columnHelper.accessor("feedbackStatus", {
      header: translate(testerSessionColumnLabels.feedback),
      cell: (context) =>
        context.getValue() === "pending" ? (
          <Badge variant="outline">
            <CircleDashedIcon aria-hidden />
            {translate(testerSessionColumnLabels.toGive)}
          </Badge>
        ) : (
          <Badge variant="secondary">
            <CheckCircle2Icon aria-hidden />
            {translate(testerSessionColumnLabels.given)}
          </Badge>
        ),
    }) as ColumnDef<TesterSessionOutputDto, unknown>,
    columnHelper.display({
      id: "actions",
      cell: (context) => {
        const session = context.row.original
        const started = fullDateTimeOf(session.createdAt, locale)
        const isPending = session.feedbackStatus === "pending"
        return (
          <div className="flex items-center justify-end gap-2">
            {isPending ? (
              <Button
                variant="outline"
                size="sm"
                aria-label={actions.giveFeedbackLabel(started)}
                onClick={() => actions.onGiveFeedback(session)}
              >
                {translate(testerSessionColumnLabels.giveFeedback)}
              </Button>
            ) : null}
            <Link
              to="/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/test/sessions/$sessionId"
              params={{ ...campaign, sessionId: session.id }}
              aria-label={isPending ? actions.chatLabel(started) : actions.viewLabel(started)}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              {translate(
                isPending ? testerSessionColumnLabels.chat : testerSessionColumnLabels.view,
              )}
            </Link>
            {isPending ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={actions.deleteLabel(started)}
                onClick={() => actions.onDelete(session)}
              >
                <Trash2Icon aria-hidden />
              </Button>
            ) : (
              // Keeps the buttons of every row in line.
              <span aria-hidden className="size-7" />
            )}
          </div>
        )
      },
      meta: { cellClassName: "text-right" },
    }),
  ]
}
