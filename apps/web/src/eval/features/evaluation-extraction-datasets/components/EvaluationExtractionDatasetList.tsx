import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { Grid, GridContent, GridHeader, GridItem } from "@/common/components/grid/Grid"
import { buildSince } from "@/common/utils/build-date"
import type { EvaluationExtractionDataset } from "@/eval/features/evaluation-extraction-datasets/evaluation-extraction-datasets.models"
import { useEvaluationExtractionDatasetPath } from "@/eval/hooks/use-evaluation-extraction-dataset-path"
import { EmptyEvaluationExtractionDataset } from "./EmptyEvaluationExtractionDataset"
import { EvaluationExtractionDatasetCreator } from "./EvaluationExtractionDatasetCreator"
import { RenameEvaluationExtractionDatasetDialog } from "./RenameEvaluationExtractionDatasetDialog"

export function EvaluationExtractionDatasetList({
  datasets,
}: {
  datasets: EvaluationExtractionDataset[]
}) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const handleBack = () => {
    navigate(-1)
  }
  if (datasets.length === 0) return <EmptyEvaluationExtractionDataset />
  return (
    <Grid cols={3} total={datasets.length} extraItems={1}>
      <GridHeader
        title={t("evaluation:dataset.title")}
        description={t("evaluation:dataset.description")}
        onBack={handleBack}
      />

      <GridContent>
        <GridItem
          className="bg-muted/35"
          title={t("evaluation:dataset.create.title")}
          description={t("evaluation:dataset.create.description")}
          index={0}
          action={<EvaluationExtractionDatasetCreator />}
        />

        {datasets.map((dataset, index) => (
          <Item key={dataset.id} dataset={dataset} index={index + 1} />
        ))}
      </GridContent>
    </Grid>
  )
}

function Item({ dataset, index }: { dataset: EvaluationExtractionDataset; index: number }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const date = buildSince(dataset.createdAt)
  const { buildEvaluationExtractionDatasetPath } = useEvaluationExtractionDatasetPath()

  const handleClick = () => {
    const path = buildEvaluationExtractionDatasetPath({ datasetId: dataset.id })
    navigate(path)
  }

  return (
    <GridItem
      badge={t("evaluation:dataset.dataset")}
      title={dataset.name}
      description={date}
      index={index}
      onClick={handleClick}
      topAction={<RenameEvaluationExtractionDatasetDialog dataset={dataset} />}
    />
  )
}
