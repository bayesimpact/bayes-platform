import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@caseai-connect/app-ui/components/sheet"
import { ExternalLink } from "@caseai-connect/app-ui/compositions/ExternalLink"
import type {
  ExtractionDatasetColumnDto,
  ExtractionRunKeyMappingEntryDto,
  ExtractionRunRecordOutputDto,
} from "@caseai-connect/eval-contracts"
import { toHttpsUrl } from "@caseai-connect/frontend-lib"
import { Trans } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { CheckIcon, XIcon } from "lucide-react"
import { canReadTracesQueryOptions } from "@/features/account"
import { cellTextOf } from "@/lib/extraction-columns"
import { SUCCESS_TEXT_CLASSES } from "@/lib/success-classes"
import { comparedFieldOf } from "../key-mapping"
import { RecordStatusBadge } from "./RecordStatusBadge"

export type ExtractionRecordSheetProps = {
  /** The record to read, or `null` while the sheet is closed. */
  record: ExtractionRunRecordOutputDto | null
  /** The columns of the dataset the agent reads, and those shown beside the results. */
  shownColumns: ExtractionDatasetColumnDto[]
  /** The fields the run reads, compared or only shown. */
  keyMapping: ExtractionRunKeyMappingEntryDto[]
  /** The name of the dataset's column a field is compared with, by the column's id. */
  columnNameOf: (columnId: string) => string
  onClose: () => void
}

/**
 * A record of an extraction run, whole and easy to read, which the table shortens: what the agent
 * read, then each field with what the agent returned beside the value expected, the error that
 * stopped it and the trace of the answer.
 */
export function ExtractionRecordSheet({
  record,
  shownColumns,
  keyMapping,
  columnNameOf,
  onClose,
}: ExtractionRecordSheetProps) {
  // The trace of an answer is for the few who may read traces.
  const { data: canReadTraces } = useSuspenseQuery(canReadTracesQueryOptions())
  // The link of a trace comes from the API: only an http(s) URL opens.
  const traceUrl = record?.traceUrl ? toHttpsUrl(record.traceUrl, { allowHttp: true }) : null
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
            <Trans comment="The title of the sheet that shows one result of a run">Result</Trans>
          </SheetTitle>
          <SheetDescription>
            <Trans>
              What the agent read, and each field it returned beside the value expected.
            </Trans>
          </SheetDescription>
        </SheetHeader>
        {record ? (
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <RecordStatusBadge status={record.status} />
              {traceUrl && canReadTraces ? (
                <ExternalLink href={traceUrl} className="ml-auto inline-flex gap-1 text-sm">
                  <Trans comment="A link to the trace of the agent's answer">Open the trace</Trans>
                </ExternalLink>
              ) : null}
            </div>
            {shownColumns.map((column) => (
              <section key={column.id} className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">{column.finalName}</h3>
                <p className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap wrap-anywhere">
                  {cellTextOf(record.datasetRecordData?.[column.id]) || "–"}
                </p>
              </section>
            ))}
            {record.comparison ? (
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">
                  <Trans comment="The title of the fields of a record of an extraction run">
                    Fields
                  </Trans>
                </h3>
                <ul className="flex flex-col divide-y rounded-lg border">
                  {keyMapping.map((entry) => {
                    const field = comparedFieldOf(record.comparison, entry.agentOutputKey)
                    if (!field) return null
                    const isMatch = field.status === "match"
                    const Mark = isMatch ? CheckIcon : XIcon
                    const columnName = columnNameOf(entry.datasetColumnId)
                    return (
                      <li key={entry.agentOutputKey} className="flex flex-col gap-2 p-3 text-sm">
                        <div className="flex items-center gap-1.5">
                          {field.status === "fyi" ? null : (
                            <Mark
                              aria-hidden
                              className={cn(
                                "size-4 shrink-0",
                                isMatch ? SUCCESS_TEXT_CLASSES : "text-destructive",
                              )}
                            />
                          )}
                          <span className="font-mono font-medium">{entry.agentOutputKey}</span>
                          {field.status === "fyi" ? (
                            <span className="text-xs text-muted-foreground">
                              <Trans comment="Beside a field of a record that a run shows and does not compare">
                                Not compared
                              </Trans>
                            </span>
                          ) : null}
                        </div>
                        <dl className="grid gap-2 sm:grid-cols-2">
                          <div className="flex flex-col gap-1">
                            <dt className="text-xs text-muted-foreground">
                              <Trans comment="What the agent returned for a field">
                                Agent's value
                              </Trans>
                            </dt>
                            <dd
                              className={cn(
                                "whitespace-pre-wrap wrap-anywhere",
                                field.status === "mismatch" && "text-destructive",
                              )}
                            >
                              {cellTextOf(field.agentValue) || "–"}
                            </dd>
                          </div>
                          {field.status === "fyi" ? null : (
                            <div className="flex flex-col gap-1">
                              <dt className="text-xs text-muted-foreground">
                                <Trans comment="The value a field should have, with the name of its column">
                                  Expected ({columnName})
                                </Trans>
                              </dt>
                              <dd className="whitespace-pre-wrap wrap-anywhere">
                                {cellTextOf(field.groundTruth) || "–"}
                              </dd>
                            </div>
                          )}
                        </dl>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ) : null}
            {record.errorDetails ? (
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-destructive">
                  <Trans comment="The title of the error that stopped a record of a run">
                    Error
                  </Trans>
                </h3>
                <p className="rounded-lg border border-destructive/30 p-3 text-sm whitespace-pre-wrap wrap-anywhere text-destructive">
                  {record.errorDetails}
                </p>
              </section>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
