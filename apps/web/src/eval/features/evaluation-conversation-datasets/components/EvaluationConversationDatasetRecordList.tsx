import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@caseai-connect/ui/shad/card"
import { useTranslation } from "react-i18next"
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
import { CreateEvaluationConversationDatasetRecordDialog } from "./CreateEvaluationConversationDatasetRecordDialog"
import { DeleteEvaluationConversationDatasetRecordButton } from "./DeleteEvaluationConversationDatasetRecordButton"
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
          <CreateEvaluationConversationDatasetRecordDialog datasetId={dataset.id} />
        </CardAction>
      </CardHeader>
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
  const { t } = useTranslation()
  const totalPages = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE))

  return (
    <CardContent>
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full caption-bottom text-sm">
          <thead className="bg-muted/50 sticky top-0 z-10 [&_tr]:border-b">
            <tr className="border-b transition-colors">
              <th
                className="text-foreground h-auto px-2 py-2 text-left align-bottom font-medium whitespace-nowrap"
                style={{ width: 48 }}
              >
                #
              </th>
              <th className="text-foreground h-auto px-2 py-2 text-left align-bottom font-medium whitespace-nowrap">
                {t("evaluationConversationDataset:record.props.input")}
              </th>
              <th className="text-foreground h-auto px-2 py-2 text-left align-bottom font-medium whitespace-nowrap">
                {t("evaluationConversationDataset:record.props.expectedOutput")}
              </th>
              <th
                className="text-foreground h-auto px-2 py-2 text-left align-bottom font-medium whitespace-nowrap"
                style={{ width: 96 }}
              />
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={4} className="h-24 text-center text-muted-foreground p-2">
                  {t("status:noResults")}
                </td>
              </tr>
            ) : (
              records.map((record, recordIndex) => (
                <tr
                  key={record.id}
                  className={`border-b transition-colors hover:bg-muted/50 ${recordIndex % 2 !== 0 ? "bg-muted/30" : ""}`}
                >
                  <td className="p-2 align-middle whitespace-nowrap">
                    <span className="font-mono text-xs text-muted-foreground/60 select-none">
                      {pageIndex * DEFAULT_PAGE_SIZE + recordIndex + 1}
                    </span>
                  </td>
                  <td
                    className="p-2 align-middle whitespace-nowrap"
                    style={{ width: 300, maxWidth: 400 }}
                  >
                    <TruncatedCell value={record.input} />
                  </td>
                  <td
                    className="p-2 align-middle whitespace-nowrap"
                    style={{ width: 300, maxWidth: 400 }}
                  >
                    <TruncatedCell value={record.expectedOutput} />
                  </td>
                  <td className="p-2 align-middle whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <UpdateEvaluationConversationDatasetRecordDialog
                        datasetId={datasetId}
                        record={record}
                      />
                      <DeleteEvaluationConversationDatasetRecordButton
                        datasetId={datasetId}
                        recordId={record.id}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
