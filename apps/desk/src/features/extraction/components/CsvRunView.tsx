import type { CsvExtractionRecordOutputDto } from "@caseai-connect/desk-contracts"
import { useLingui } from "@lingui/react/macro"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { DeleteEntryDialog, extractionDocumentsQueryOptions } from "@/features/history"
import { durationOf } from "@/lib/relative-time"
import type { CsvRecordsPage } from "../api/keys"
import { csvRecordsQueryOptions, csvRunQueryOptions, isCsvRunLive } from "../api/queries"
import { shownFileColumnsOf } from "../csv-records"
import type { ExtractionAgentRef } from "../extraction-agent"
import { CsvRecordPanel } from "./CsvRecordPanel"
import { CsvRecordsTable } from "./CsvRecordsTable"
import { CsvRunActions } from "./CsvRunActions"
import { CsvRunProgress } from "./CsvRunProgress"
import { RunHeader } from "./RunHeader"
import { type RunState, RunStatusBadge } from "./RunStatusBadge"

export type CsvRunViewProps = {
  agent: ExtractionAgentRef
  csvRunId: string
  page: CsvRecordsPage
  onPageChange: (page: CsvRecordsPage) => void
}

const STATES: Record<string, RunState> = {
  pending: "starting",
  running: "running",
  completed: "done",
  failed: "failed",
  cancelled: "stopped",
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
  // useQuery: another page or order keeps the rows shown until its rows arrive.
  const records = useQuery(csvRecordsQueryOptions(agent, csvRunId, page, isLive))
  const [open, setOpen] = useState<{
    record: CsvExtractionRecordOutputDto | null
    isDeleting: boolean
  }>({
    record: null,
    isDeleting: false,
  })

  const fileColumns = shownFileColumnsOf(run.columnSchema)
  const title =
    documents.find((document) => document.id === run.csvDocumentId)?.fileName ?? t`CSV file`
  const tookTime = durationOf(run.updatedAt - run.createdAt, i18n.locale)
  // The row open beside the table follows the page's refreshes.
  const openRecord = open.record
    ? (records.data?.records.find((record) => record.id === open.record?.id) ?? open.record)
    : null

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pt-10 pb-16">
          <CsvRunActions
            agent={agent}
            run={run}
            onDelete={() => setOpen((current) => ({ ...current, isDeleting: true }))}
          />
          <RunHeader
            fileKind="csv"
            title={title}
            status={<RunStatusBadge state={STATES[run.status] ?? "running"} />}
            createdAt={run.createdAt}
            duration={isLive ? undefined : t`Took ${tookTime}`}
            now={Date.now()}
          />
          <CsvRunProgress run={run} />
          {records.data ? (
            <CsvRecordsTable
              records={records.data}
              page={page}
              fileColumns={fileColumns}
              isRefreshing={records.isPlaceholderData}
              isLive={isLive}
              openRecordId={openRecord?.id ?? null}
              onPageChange={onPageChange}
              onOpenRecord={(record) => setOpen((current) => ({ ...current, record }))}
            />
          ) : null}
        </div>
      </div>
      {openRecord ? (
        <CsvRecordPanel
          record={openRecord}
          fileColumns={fileColumns}
          onClose={() => setOpen((current) => ({ ...current, record: null }))}
        />
      ) : null}
      <DeleteEntryDialog
        agent={agent}
        entry={{ kind: "csv", id: csvRunId }}
        title={title}
        open={open.isDeleting}
        onOpenChange={(isDeleting) => setOpen((current) => ({ ...current, isDeleting }))}
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
