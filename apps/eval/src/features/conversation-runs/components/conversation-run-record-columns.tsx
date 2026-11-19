import type { ConversationRunRecordOutputDto } from "@caseai-connect/eval-contracts"
import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"
import { Trans } from "@lingui/react/macro"
import { type ColumnDef, createColumnHelper } from "@tanstack/react-table"
import { LoaderCircleIcon } from "lucide-react"
import { ExternalLink } from "@/components/shared/ExternalLink"
import { Badge } from "@/components/ui/badge"
import { scoreOf } from "../run-status"

const columnHelper = createColumnHelper<ConversationRunRecordOutputDto>()

/** The texts of the headers, which the table translates. */
const recordColumnLabels = {
  input: msg({ message: "Input", comment: "What an evaluation sends to the agent" }),
  expectedOutput: msg({
    message: "Expected output",
    comment: "The answer an evaluation expects from the agent",
  }),
  output: msg({ message: "Agent's answer", comment: "What the agent answered in a run" }),
  score: msg({ message: "Score", comment: "The score the judge gave an answer" }),
} satisfies Record<string, MessageDescriptor>

/** A record's text in a cell: whole, on as many lines as it takes. */
function RecordText({ children }: { children: string }) {
  return <p className="min-w-40 whitespace-pre-wrap wrap-anywhere">{children}</p>
}

/** The columns of a run's records: what the agent got, what it should answer, what it answered. */
export function conversationRunRecordColumnsOf({
  locale,
  translate,
}: {
  locale: string
  translate: (descriptor: MessageDescriptor) => string
}): ColumnDef<ConversationRunRecordOutputDto, unknown>[] {
  // Safe: each helper call types its own value, and the list holds them as columns of any value.
  return [
    columnHelper.accessor("input", {
      header: translate(recordColumnLabels.input),
      enableSorting: false,
      cell: (context) => <RecordText>{context.getValue()}</RecordText>,
    }),
    columnHelper.accessor("expectedOutput", {
      header: translate(recordColumnLabels.expectedOutput),
      enableSorting: false,
      cell: (context) => <RecordText>{context.getValue()}</RecordText>,
    }),
    columnHelper.accessor("output", {
      header: translate(recordColumnLabels.output),
      enableSorting: false,
      cell: (context) => {
        const { status, errorDetails, traceUrl } = context.row.original
        const output = context.getValue()
        return (
          <div className="flex flex-col items-start gap-1">
            {output ? <RecordText>{output}</RecordText> : null}
            {status === "running" ? (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <LoaderCircleIcon aria-hidden className="size-3.5 animate-spin" />
                <Trans comment="A record of a run the agent has not answered yet">Waiting</Trans>
              </span>
            ) : null}
            {status === "cancelled" ? (
              <span className="text-muted-foreground">
                <Trans comment="A record of a run stopped before the agent answered it">
                  Not asked
                </Trans>
              </span>
            ) : null}
            {status === "error" ? (
              <p className="rounded-md border border-destructive/30 px-2 py-1.5 text-xs whitespace-pre-wrap wrap-anywhere text-destructive">
                <Trans comment="Before the error that stopped a record of a run">
                  <span className="font-medium">Error:</span> {errorDetails ?? "–"}
                </Trans>
              </p>
            ) : null}
            {traceUrl ? (
              <ExternalLink href={traceUrl} className="text-xs">
                <Trans comment="A link to the trace of the agent's answer">Open the trace</Trans>
              </ExternalLink>
            ) : null}
          </div>
        )
      },
    }),
    columnHelper.accessor("score", {
      header: translate(recordColumnLabels.score),
      enableSorting: false,
      cell: (context) => {
        const score = context.getValue()
        if (score === null) return "–"
        return (
          <Badge variant={score >= 0.75 ? "secondary" : score >= 0.5 ? "outline" : "destructive"}>
            {scoreOf(score, locale)}
          </Badge>
        )
      },
      meta: { headerClassName: "text-right", cellClassName: "text-right tabular-nums" },
    }),
  ] as ColumnDef<ConversationRunRecordOutputDto, unknown>[]
}
