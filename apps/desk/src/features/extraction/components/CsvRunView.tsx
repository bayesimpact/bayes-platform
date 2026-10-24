import type { AgentParamsDto, CsvExtractionRecordOutputDto } from "@caseai-connect/desk-contracts"
import { useLingui } from "@lingui/react/macro"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { DeleteEntryDialog, extractionDocumentsQueryOptions } from "@/features/history"
import { RELATIVE_TIME_INTERVAL_IN_MILLISECONDS, useNow } from "@/hooks/use-now"
import { durationOf } from "@/lib/format-time"
import { csvRecordsQueryOptions, csvRunQueryOptions, isCsvRunLive } from "../api/queries"
import { shownFileColumnsOf } from "../csv-records"
import { CSV_RUN_STATES } from "../run-states"
import type { CsvRecordsPage } from "../schemas"
import { CsvRecordPanel } from "./CsvRecordPanel"
import { CsvRecordsError } from "./CsvRecordsError"
import { CsvRecordsSkeleton } from "./CsvRecordsSkeleton"
import { CsvRecordsTable } from "./CsvRecordsTable"
import { CsvRunActions } from "./CsvRunActions"
import { CsvRunProgress } from "./CsvRunProgress"
import { RunHeader } from "./RunHeader"
import { RunStatusBadge } from "./RunStatusBadge"

export type CsvRunViewProps = {
  agent: AgentParamsDto
  csvRunId: string
  page: CsvRecordsPage
  onPageChange: (page: CsvRecordsPage) => void
}

/**
 * The extraction of a CSV file: how far it went, its rows as a table, a page at a time, and one
 * row in full beside it.
 */
export function CsvRunView({ agent, csvRunId, page, onPageChange }: CsvRunViewProps) {
  const { t, i18n } = useLingui()
  const navigate = useNavigate()
  const { data: run } = useSuspenseQuery(csvRunQueryOptions(agent, csvRunId))
  const { data: documents } = useSuspenseQuery(extractionDocumentsQueryOptions(agent))
  const isLive = isCsvRunLive(run.status)
  const now = useNow(RELATIVE_TIME_INTERVAL_IN_MILLISECONDS, true)
  // useQuery: another page or order keeps the rows shown until its rows arrive.
  const records = useQuery(csvRecordsQueryOptions(agent, csvRunId, page, isLive))
  // What shows beside or over the table: a row in full, and the confirmation of a deletion.
  const [overlay, setOverlay] = useState<{
    record: CsvExtractionRecordOutputDto | null
    isDeleting: boolean
  }>({ record: null, isDeleting: false })

  const fileColumns = shownFileColumnsOf(run.columnSchema)
  const title =
    documents.find((document) => document.id === run.csvDocumentId)?.fileName ?? t`CSV file`
  const tookTime = durationOf(run.updatedAt - run.createdAt, i18n.locale)
  // The row open beside the table follows the page's refreshes.
  const openRecord = overlay.record
    ? (records.data?.records.find((record) => record.id === overlay.record?.id) ?? overlay.record)
    : null

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pt-10 pb-16">
          <CsvRunActions
            agent={agent}
            run={run}
            onDelete={() => setOverlay((current) => ({ ...current, isDeleting: true }))}
          />
          <RunHeader
            fileKind="csv"
            title={title}
            status={<RunStatusBadge state={CSV_RUN_STATES[run.status]} />}
            createdAt={run.createdAt}
            duration={isLive ? undefined : t`Took ${tookTime}`}
            now={now}
          />
          <CsvRunProgress run={run} />
          {records.isError && !records.data ? (
            <CsvRecordsError onRetry={() => void records.refetch()} />
          ) : null}
          {records.isPending ? <CsvRecordsSkeleton /> : null}
          {records.data ? (
            <CsvRecordsTable
              records={records.data}
              page={page}
              fileColumns={fileColumns}
              isRefreshing={records.isPlaceholderData}
              isLive={isLive}
              openRecordId={openRecord?.id ?? null}
              onPageChange={onPageChange}
              onOpenRecord={(record) => setOverlay((current) => ({ ...current, record }))}
            />
          ) : null}
        </div>
      </div>
      {openRecord ? (
        <CsvRecordPanel
          record={openRecord}
          fileColumns={fileColumns}
          onClose={() => setOverlay((current) => ({ ...current, record: null }))}
        />
      ) : null}
      <DeleteEntryDialog
        agent={agent}
        entry={{ kind: "csv", id: csvRunId }}
        title={title}
        isOpen={overlay.isDeleting}
        onOpenChange={(isDeleting) => setOverlay((current) => ({ ...current, isDeleting }))}
        onDeleted={() =>
          void navigate({
            to: "/o/$organizationId/p/$projectId/a/$agentId/extraction",
            params: agent,
          })
        }
      />
    </div>
  )
}
