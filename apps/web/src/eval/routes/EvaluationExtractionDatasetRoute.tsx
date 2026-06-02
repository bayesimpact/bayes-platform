import { useTranslation } from "react-i18next"
import { useNavigate, useOutlet } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import { Loader } from "@/common/components/Loader"
import { useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { LoadingRoute } from "@/common/routes/LoadingRoute"
import { useAppSelector } from "@/common/store/hooks"
import { buildSince } from "@/common/utils/build-date"
import { EvaluationExtractionDatasetInitializer } from "../features/evaluation-extraction-datasets/components/EvaluationExtractionDatasetInitializer"
import { EvaluationExtractionDatasetRecordList } from "../features/evaluation-extraction-datasets/components/EvaluationExtractionDatasetRecordList"
import { RenameEvaluationExtractionDatasetDialog } from "../features/evaluation-extraction-datasets/components/RenameEvaluationExtractionDatasetDialog"
import {
  selectCurrentDatasetData,
  selectCurrentDatasetId,
  selectIsUpdatingDataset,
} from "../features/evaluation-extraction-datasets/evaluation-extraction-datasets.selectors"
import { EvaluationExtractionRunHistory } from "../features/evaluation-extraction-runs/components/EvaluationExtractionRunHistory"
import { RunEvaluationExtractionDialog } from "../features/evaluation-extraction-runs/components/RunEvaluationExtractionDialog"
import { selectEvaluationExtractionRunsData } from "../features/evaluation-extraction-runs/evaluation-extraction-runs.selectors"

export function EvaluationExtractionDatasetRoute() {
  const datasetId = useAppSelector(selectCurrentDatasetId)
  const dataset = useAppSelector(selectCurrentDatasetData)
  const runs = useAppSelector(selectEvaluationExtractionRunsData)
  const outlet = useOutlet()

  if (!datasetId) return <LoadingRoute />
  return <AsyncRoute data={[dataset, runs]}>{outlet ? outlet : <WithData />}</AsyncRoute>
}

function WithData() {
  const dataset = useValue(selectCurrentDatasetData)
  const navigate = useNavigate()

  const { t } = useTranslation()
  const isUpdatingDataset = useAppSelector(selectIsUpdatingDataset)
  const isDatasetEmpty = Object.values(dataset.schemaMapping).length === 0

  const handleBack = () => navigate(-1)

  const title = isDatasetEmpty
    ? t("evaluation:dataset.update.title", { datasetName: dataset.name })
    : dataset.name

  const description = isDatasetEmpty
    ? t("evaluation:dataset.update.description")
    : buildSince(dataset.updatedAt)

  return (
    <div>
      <GridHeader
        title={title}
        description={description}
        onBack={handleBack}
        action={
          <>
            {!isDatasetEmpty ? <RunEvaluationExtractionDialog dataset={dataset} /> : undefined}

            <RenameEvaluationExtractionDatasetDialog
              dataset={dataset}
              buttonProps={{ variant: "outline", size: "icon" }}
            />
          </>
        }
      />

      <div className="p-6">
        {isUpdatingDataset ? (
          <Loader />
        ) : isDatasetEmpty ? (
          <EvaluationExtractionDatasetInitializer dataset={dataset} />
        ) : (
          <div className="flex flex-col gap-6">
            <EvaluationExtractionDatasetRecordList dataset={dataset} />
            <RunListWithData datasetId={dataset.id} />
          </div>
        )}
      </div>
    </div>
  )
}

function RunListWithData({ datasetId }: { datasetId: string }) {
  const runsData = useValue(selectEvaluationExtractionRunsData)
  return (
    <EvaluationExtractionRunHistory
      runs={runsData.filter((run) => run.evaluationExtractionDatasetId === datasetId)}
    />
  )
}
