import type { ConversationDatasetRecordOutputDto } from "@bayes-platform/eval-contracts"
import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"
import { Trans } from "@lingui/react/macro"
import { type ColumnDef, createColumnHelper } from "@tanstack/react-table"
import type { ReactNode } from "react"
import { rowNumberColumnOf } from "@/components/shared/row-number-column"

const columnHelper = createColumnHelper<ConversationDatasetRecordOutputDto>()

/** The texts of the headers, which the table translates. */
const recordColumnLabels = {
  input: msg({ message: "Input", comment: "What an evaluation sends to the agent" }),
  expectedOutput: msg({
    message: "Expected output",
    comment: "The answer an evaluation expects from the agent",
  }),
} satisfies Record<string, MessageDescriptor>

/** A record's text in a cell: whole, on as many lines as it takes. */
function RecordText({ children }: { children: string }) {
  return <p className="min-w-48 whitespace-pre-wrap wrap-anywhere">{children}</p>
}

/** The columns of a dataset's records: what the agent gets, then what it should answer. */
export function conversationRecordColumnsOf({
  translate,
  renderActions,
}: {
  translate: (descriptor: MessageDescriptor) => string
  /** What the person can do with a record, or `null` when nothing. */
  renderActions: ((record: ConversationDatasetRecordOutputDto) => ReactNode) | null
}): ColumnDef<ConversationDatasetRecordOutputDto, unknown>[] {
  // Safe: each helper call types its own value, and the list holds them as columns of any value.
  const columns = [
    rowNumberColumnOf<ConversationDatasetRecordOutputDto>(),
    columnHelper.accessor("input", {
      header: translate(recordColumnLabels.input),
      enableSorting: false,
      cell: (context) => <RecordText>{context.getValue()}</RecordText>,
    }),
    columnHelper.accessor("expectedOutput", {
      header: translate(recordColumnLabels.expectedOutput),
      enableSorting: false,
      cell: (context) => {
        const comment = context.row.original.comment
        return (
          <div className="flex flex-col gap-1">
            <RecordText>{context.getValue()}</RecordText>
            {comment ? (
              <p className="rounded-md border px-2 py-1.5 text-xs whitespace-pre-wrap wrap-anywhere text-muted-foreground">
                <Trans comment="Before the comment a person wrote in the Studio when they saved an answer as a test case">
                  <span className="font-medium text-foreground">Comment:</span> {comment}
                </Trans>
              </p>
            ) : null}
          </div>
        )
      },
    }),
  ] as ColumnDef<ConversationDatasetRecordOutputDto, unknown>[]
  if (renderActions) {
    columns.push(
      columnHelper.display({
        id: "actions",
        header: () => null,
        cell: (context) => (
          <div className="flex justify-end gap-1">{renderActions(context.row.original)}</div>
        ),
      }),
    )
  }
  return columns
}
