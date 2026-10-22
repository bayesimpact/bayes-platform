import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@caseai-connect/ui/shad/card"
import { type ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { DataTable } from "@/common/components/data-table/DataTable"
import { Loader } from "@/common/components/Loader"
import { ADS } from "@/common/store/async-data-status"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import {
  DEFAULT_PAGE_SIZE,
  PaginationControls,
  TruncatedCell,
} from "@/eval/components/shared/RecordTableParts"
import type {
  EvaluationConversationDataset,
  EvaluationConversationDatasetRecord,
} from "@/eval/features/evaluation-conversation-datasets/evaluation-conversation-datasets.models"
import { selectConversationDatasetRecordsData } from "@/eval/features/evaluation-conversation-datasets/evaluation-conversation-datasets.selectors"
import { evaluationConversationDatasetsActions } from "@/eval/features/evaluation-conversation-datasets/evaluation-conversation-datasets.slice"
import { BulkAddEvaluationConversationDatasetRecordsDialog } from "./BulkAddEvaluationConversationDatasetRecordsDialog"
import { DeleteEvaluationConversationDatasetRecordButton } from "./DeleteEvaluationConversationDatasetRecordButton"
import { QuickAddEvaluationConversationDatasetRecordRow } from "./QuickAddEvaluationConversationDatasetRecordRow"
import { UpdateEvaluationConversationDatasetRecordDialog } from "./UpdateEvaluationConversationDatasetRecordDialog"

export function EvaluationConversationDatasetRecordList({
  dataset,
}: {
  dataset: EvaluationConversationDataset
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const recordsData = useAppSelector(selectConversationDatasetRecordsData)

  // The initial page is loaded by the dataset route via mountRecords (ADR 0009);
  // the leaf only refetches when the user changes page.
  const handlePageChange = (newPageIndex: number) => {
    dispatch(
      evaluationConversationDatasetsActions.listRecords({
        datasetId: dataset.id,
        page: newPageIndex,
        limit: DEFAULT_PAGE_SIZE,
      }),
    )
  }

  const records = ADS.isFulfilled(recordsData) ? recordsData.value.records : []
  const total = ADS.isFulfilled(recordsData) ? recordsData.value.total : 0
  const pageIndex = ADS.isFulfilled(recordsData) ? recordsData.value.page : 0
  const isLoading = ADS.isLoading(recordsData)

  return (
    <Card className="border-0 shadow-none">
      <CardHeader>
        <CardTitle>{t("evaluationConversationDataset:record.view.title")}</CardTitle>
        <CardDescription>
          {t("evaluationConversationDataset:record.view.description", { count: total })}
        </CardDescription>
        <CardAction>
          <BulkAddEvaluationConversationDatasetRecordsDialog datasetId={dataset.id} />
        </CardAction>
      </CardHeader>
      <CardContent className="pb-0">
        <QuickAddEvaluationConversationDatasetRecordRow datasetId={dataset.id} />
      </CardContent>
      {isLoading ? (
        <Loader />
      ) : (
        <RecordsTable
          datasetId={dataset.id}
          records={records}
          total={total}
          pageIndex={pageIndex}
          onPageChange={handlePageChange}
        />
      )}
    </Card>
  )
}

function RecordsTable({
  datasetId,
  records,
  total,
  pageIndex,
  onPageChange,
}: {
  datasetId: string
  records: EvaluationConversationDatasetRecord[]
  total: number
  pageIndex: number
  onPageChange: (pageIndex: number) => void
}) {
  // TanStack Table keeps one table instance across renders, so the React Compiler would
  // memoize its row model and show stale rows after a page change.
  "use no memo"
  const { t } = useTranslation()
  const totalPages = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE))

  const columns = useMemo<ColumnDef<EvaluationConversationDatasetRecord>[]>(
    () => [
      {
        id: "index",
        header: () => "#",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground/60 select-none">
            {pageIndex * DEFAULT_PAGE_SIZE + row.index + 1}
          </span>
        ),
        size: 48,
      },
      {
        id: "input",
        header: () => t("evaluationConversationDataset:record.props.input"),
        cell: ({ row }) => <TruncatedCell value={row.original.input} />,
        size: 300,
      },
      {
        id: "expectedOutput",
        header: () => t("evaluationConversationDataset:record.props.expectedOutput"),
        cell: ({ row }) => <TruncatedCell value={row.original.expectedOutput} />,
        size: 300,
      },
      {
        id: "comment",
        header: () => t("evaluationConversationDataset:record.props.comment"),
        // Why the expected output is the reference, for a record saved from an answer.
        cell: ({ row }) =>
          row.original.comment ? <TruncatedCell value={row.original.comment} /> : null,
        size: 240,
      },
      {
        id: "actions",
        header: () => null,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <UpdateEvaluationConversationDatasetRecordDialog
              datasetId={datasetId}
              record={row.original}
            />
            <DeleteEvaluationConversationDatasetRecordButton
              datasetId={datasetId}
              recordId={row.original.id}
            />
          </div>
        ),
        size: 96,
      },
    ],
    [t, datasetId, pageIndex],
  )

  const table = useReactTable({
    data: records,
    columns,
    getRowId: (record) => record.id,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <CardContent>
      <DataTable
        table={table}
        empty={<p className="py-8 text-center text-muted-foreground">{t("status:noResults")}</p>}
      />

      {totalPages > 1 && (
        <PaginationControls
          pageIndex={pageIndex}
          pageCount={totalPages}
          total={total}
          onPageChange={onPageChange}
        />
      )}
    </CardContent>
  )
}
