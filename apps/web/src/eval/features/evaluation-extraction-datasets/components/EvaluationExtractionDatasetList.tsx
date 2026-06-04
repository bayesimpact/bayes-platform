import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { Grid, GridCard, GridContent, GridHeader } from "@/common/components/grid/Grid"
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
    <Grid cols={3}>
      <GridHeader
        title={t("evaluation:dataset.title")}
        description={t("evaluation:dataset.description")}
        onBack={handleBack}
      />

      <GridContent>
        <GridCard className="bg-muted/35">
          <GridCard.Body>
            <GridCard.Title>{t("evaluation:dataset.create.title")}</GridCard.Title>
            <GridCard.Description>
              {t("evaluation:dataset.create.description")}
            </GridCard.Description>
            <EvaluationExtractionDatasetCreator />
          </GridCard.Body>
        </GridCard>

        {datasets.map((dataset) => (
          <Item key={dataset.id} dataset={dataset} />
        ))}
      </GridContent>
    </Grid>
  )
}

function Item({ dataset }: { dataset: EvaluationExtractionDataset }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const date = buildSince(dataset.updatedAt)
  const { buildEvaluationExtractionDatasetPath } = useEvaluationExtractionDatasetPath()

  const handleClick = () => {
    const path = buildEvaluationExtractionDatasetPath({ datasetId: dataset.id })
    navigate(path)
  }

  return (
    <GridCard>
      <GridCard.TopAction>
        <RenameEvaluationExtractionDatasetDialog dataset={dataset} />
        <DeleteEvaluationExtractionDatasetButton datasetId={dataset.id} />
      </GridCard.TopAction>
      <GridCard.Badge>{t("evaluation:dataset.dataset")}</GridCard.Badge>
      <GridCard.Body>
        <GridCard.Title>{dataset.name}</GridCard.Title>
        <GridCard.Description>{date}</GridCard.Description>
        <GridCard.GoButton onClick={handleClick} />
      </GridCard.Body>
    </GridCard>
  )
}
