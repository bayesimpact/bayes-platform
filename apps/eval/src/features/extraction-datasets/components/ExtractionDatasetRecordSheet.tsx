import { Badge } from "@caseai-connect/app-ui/components/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@caseai-connect/app-ui/components/sheet"
import type {
  ExtractionDatasetColumnDto,
  ExtractionDatasetRecordOutputDto,
} from "@caseai-connect/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { cellTextOf } from "@/lib/extraction-columns"

export type ExtractionDatasetRecordSheetProps = {
  /** The record to read, or `null` while the sheet is closed. */
  record: ExtractionDatasetRecordOutputDto | null
  /** The columns of the dataset, in the order of its file. */
  columns: ExtractionDatasetColumnDto[]
  roleLabelOf: (column: ExtractionDatasetColumnDto) => string
  onClose: () => void
}

/** A record of a dataset, whole and easy to read, which the table shortens: each of its values. */
export function ExtractionDatasetRecordSheet({
  record,
  columns,
  roleLabelOf,
  onClose,
}: ExtractionDatasetRecordSheetProps) {
  return (
    <Sheet
      open={record !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      <SheetContent
        side="right"
        className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl"
      >
        <SheetHeader className="border-b pr-12">
          <SheetTitle>
            <Trans comment="The title of the sheet that shows one record of a dataset">
              Record
            </Trans>
          </SheetTitle>
          <SheetDescription>
            <Trans>The value of each column of the dataset, for this row of its file.</Trans>
          </SheetDescription>
        </SheetHeader>
        {record ? (
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
            {columns.map((column) => (
              <section key={column.id} className="flex flex-col gap-2">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                  {column.finalName}
                  <Badge variant="outline" className="font-normal">
                    {roleLabelOf(column)}
                  </Badge>
                </h3>
                <p className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap wrap-anywhere">
                  {cellTextOf(record.data[column.id]) || "–"}
                </p>
              </section>
            ))}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
