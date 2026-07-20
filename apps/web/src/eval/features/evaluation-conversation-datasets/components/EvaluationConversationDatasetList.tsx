import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { Grid, GridCard, GridContent, GridHeader } from "@/common/components/grid/Grid"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useCurrentId } from "@/common/hooks/use-value"
import { buildSince } from "@/common/utils/build-date"
import type { EvaluationConversationDataset } from "@/eval/features/evaluation-conversation-datasets/evaluation-conversation-datasets.models"
import { useEvaluationConversationDatasetPath } from "@/eval/hooks/use-evaluation-conversation-dataset-path"
import { EvalRoutes } from "@/eval/routes/helpers"
import { DeleteEvaluationConversationDatasetButton } from "./DeleteEvaluationConversationDatasetButton"
import { EmptyEvaluationConversationDataset } from "./EmptyEvaluationConversationDataset"
import { EvaluationConversationDatasetCreator } from "./EvaluationConversationDatasetCreator"
import { RenameEvaluationConversationDatasetDialog } from "./RenameEvaluationConversationDatasetDialog"

export function EvaluationConversationDatasetList({
  datasets,
}: {
  datasets: EvaluationConversationDataset[]
}) {
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const navigate = useNavigate()
  const { t } = useTranslation()
  const handleBack = () => {
    navigate(EvalRoutes.project.build({ organizationId, projectId }))
  }
  if (datasets.length === 0) return <EmptyEvaluationConversationDataset />
  return (
    <Grid cols={3}>
      <GridHeader
        title={t("evaluationConversationDataset:dataset.title")}
        description={t("evaluationConversationDataset:dataset.description")}
        onBack={handleBack}
      />

      <GridContent>
        <GridCard className="bg-muted/35">
          <GridCard.Body>
            <GridCard.Title>
              {t("evaluationConversationDataset:dataset.create.title")}
            </GridCard.Title>
            <GridCard.Description>
              {t("evaluationConversationDataset:dataset.create.description")}
            </GridCard.Description>
            <EvaluationConversationDatasetCreator />
          </GridCard.Body>
        </GridCard>

        {datasets.map((dataset) => (
          <Item key={dataset.id} dataset={dataset} />
        ))}
      </GridContent>
    </Grid>
  )
}

function Item({ dataset }: { dataset: EvaluationConversationDataset }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const date = buildSince(dataset.updatedAt)
  const { buildEvaluationConversationDatasetPath } = useEvaluationConversationDatasetPath()

  const handleClick = () => {
    const path = buildEvaluationConversationDatasetPath({ datasetId: dataset.id })
    navigate(path)
  }

  return (
    <GridCard>
      <GridCard.TopAction>
        <RenameEvaluationConversationDatasetDialog dataset={dataset} />
        <DeleteEvaluationConversationDatasetButton datasetId={dataset.id} />
      </GridCard.TopAction>
      <GridCard.Badge>{t("evaluationConversationDataset:dataset.dataset")}</GridCard.Badge>
      <GridCard.Body>
        <GridCard.Title>{dataset.name}</GridCard.Title>
        <GridCard.Description>{date}</GridCard.Description>
        <GridCard.GoButton onClick={handleClick} />
      </GridCard.Body>
    </GridCard>
  )
}
