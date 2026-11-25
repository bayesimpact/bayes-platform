import type { ConversationRunRecordOutputDto } from "@bayes-platform/eval-contracts"
import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"
import { Trans } from "@lingui/react/macro"
import { type ColumnDef, createColumnHelper } from "@tanstack/react-table"
import { cn } from "cn"
import { LoaderCircleIcon } from "lucide-react"
import { rowNumberColumnOf } from "@/components/shared/row-number-column"
import { CELL_TEXT_CLASSES } from "@/lib/cell-text"
import { FilledForm } from "./FilledForm"
import { RunRecordScore } from "./RunRecordScore"
import { RunRecordStatusBadge } from "./RunRecordStatusBadge"

const columnHelper = createColumnHelper<ConversationRunRecordOutputDto>()

/** The texts of the headers, which the table translates. */
const recordColumnLabels = {
  input: msg({ message: "Input", comment: "What an evaluation sends to the agent" }),
  expectedOutput: msg({
    message: "Expected output",
    comment: "The answer an evaluation expects from the agent",
  }),
  output: msg({ message: "Agent's answer", comment: "What the agent answered in a run" }),
  status: msg({ message: "Status", comment: "Where a record of a run stands" }),
  formState: msg({
    message: "Filled form",
    comment: "The fields the agent filled while it answered a record of a run",
  }),
  score: msg({ message: "Score", comment: "The score the judge gave an answer" }),
} satisfies Record<string, MessageDescriptor>

/**
 * The columns of a run's records: what the agent got, what it should answer, what it answered,
 * each cut after three lines. The input opens the record's sheet, for the keyboard: a click
 * anywhere on the row does too.
 */
export function conversationRunRecordColumnsOf({
  translate,
  hasFormState,
  openLabel,
  onOpen,
}: {
  translate: (descriptor: MessageDescriptor) => string
  /** Whether a record of the run has a form: the column of the filled forms then shows. */
  hasFormState: boolean
  /** The name of the button that opens a record, for a screen reader. */
  openLabel: (record: ConversationRunRecordOutputDto) => string
  onOpen: (record: ConversationRunRecordOutputDto) => void
}): ColumnDef<ConversationRunRecordOutputDto, unknown>[] {
  // Safe: each helper call types its own value, and the list holds them as columns of any value.
  return [
    rowNumberColumnOf<ConversationRunRecordOutputDto>(),
    columnHelper.accessor("status", {
      header: translate(recordColumnLabels.status),
      enableSorting: false,
      cell: (context) => <RunRecordStatusBadge status={context.getValue()} />,
    }),
    columnHelper.accessor("input", {
      header: translate(recordColumnLabels.input),
      enableSorting: false,
      cell: (context) => (
        <button
          type="button"
          aria-label={openLabel(context.row.original)}
          // The row opens the record on a click: the button's own click would open it twice.
          onClick={(event) => {
            event.stopPropagation()
            onOpen(context.row.original)
          }}
          className={cn(
            CELL_TEXT_CLASSES,
            "cursor-pointer rounded-sm text-left font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          )}
        >
          {context.getValue()}
        </button>
      ),
    }),
    columnHelper.accessor("expectedOutput", {
      header: translate(recordColumnLabels.expectedOutput),
      enableSorting: false,
      cell: (context) => <p className={CELL_TEXT_CLASSES}>{context.getValue()}</p>,
    }),
    columnHelper.accessor("output", {
      header: translate(recordColumnLabels.output),
      enableSorting: false,
      cell: (context) => {
        const { status, errorDetails } = context.row.original
        const output = context.getValue()
        if (output) return <p className={CELL_TEXT_CLASSES}>{output}</p>
        if (status === "running") {
          return (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <LoaderCircleIcon aria-hidden className="size-3.5 animate-spin" />
              <Trans comment="A record of a run the agent has not answered yet">Waiting</Trans>
            </span>
          )
        }
        if (status === "cancelled") {
          return (
            <span className="text-muted-foreground">
              <Trans comment="A record of a run stopped before the agent answered it">
                Not asked
              </Trans>
            </span>
          )
        }
        if (status === "error") {
          return <p className={cn(CELL_TEXT_CLASSES, "text-destructive")}>{errorDetails ?? "–"}</p>
        }
        return <span className="text-muted-foreground">–</span>
      },
    }),
    ...(hasFormState
      ? [
          columnHelper.accessor("formState", {
            header: translate(recordColumnLabels.formState),
            enableSorting: false,
            cell: (context) => <FilledForm formState={context.getValue()} isCut />,
          }),
        ]
      : []),
    columnHelper.display({
      id: "score",
      header: translate(recordColumnLabels.score),
      cell: (context) => <RunRecordScore record={context.row.original} />,
      meta: { headerClassName: "text-right", cellClassName: "text-right tabular-nums" },
    }),
  ] as ColumnDef<ConversationRunRecordOutputDto, unknown>[]
}
