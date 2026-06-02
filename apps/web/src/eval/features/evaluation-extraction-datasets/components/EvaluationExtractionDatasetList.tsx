import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { Grid, GridContent, GridHeader, GridItem } from "@/common/components/grid/Grid"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useCurrentId } from "@/common/hooks/use-value"
import { buildSince } from "@/common/utils/build-date"
import type { EvaluationExtractionDataset } from "@/eval/features/evaluation-extraction-datasets/evaluation-extraction-datasets.models"
import { useEvaluationExtractionDatasetPath } from "@/eval/hooks/use-evaluation-extraction-dataset-path"
import { EvalRoutes } from "@/eval/routes/helpers"
import { DeleteEvaluationExtractionDatasetButton } from "./DeleteEvaluationExtractionDatasetButton"
import { EmptyEvaluationExtractionDataset } from "./EmptyEvaluationExtractionDataset"
import { EvaluationExtractionDatasetCreator } from "./EvaluationExtractionDatasetCreator"
import { RenameEvaluationExtractionDatasetDialog } from "./RenameEvaluationExtractionDatasetDialog"

export function EvaluationExtractionDatasetList({
  datasets,
}: {
  datasets: EvaluationExtractionDataset[]
}) {
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const navigate = useNavigate()
  const { t } = useTranslation()
  const handleBack = () => {
    navigate(EvalRoutes.project.build({ organizationId, projectId }))
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
      topAction={
        <>
          <RenameEvaluationExtractionDatasetDialog dataset={dataset} />
          <DeleteEvaluationExtractionDatasetButton datasetId={dataset.id} />
        </>
      }
    />
  )
}
