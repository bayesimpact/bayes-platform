import { useNavigate, useOutlet } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useMount } from "@/common/hooks/use-mount"
import { useCurrentId, useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { LoadingRoute } from "@/common/routes/LoadingRoute"
import { useAppSelector } from "@/common/store/hooks"
import { buildSince } from "@/common/utils/build-date"
import { useEvalLayoutWidth } from "../components/EvalLayout"
import { DeleteEvaluationConversationDatasetButton } from "../features/evaluation-conversation-datasets/components/DeleteEvaluationConversationDatasetButton"
import { EvaluationConversationDatasetRecordList } from "../features/evaluation-conversation-datasets/components/EvaluationConversationDatasetRecordList"
import { RenameEvaluationConversationDatasetDialog } from "../features/evaluation-conversation-datasets/components/RenameEvaluationConversationDatasetDialog"
import {
  selectCurrentConversationDatasetData,
  selectCurrentConversationDatasetId,
} from "../features/evaluation-conversation-datasets/evaluation-conversation-datasets.selectors"
import { evaluationConversationDatasetsActions } from "../features/evaluation-conversation-datasets/evaluation-conversation-datasets.slice"
import { EvaluationConversationRunHistory } from "../features/evaluation-conversation-runs/components/EvaluationConversationRunHistory"
import { RunEvaluationConversationDialog } from "../features/evaluation-conversation-runs/components/RunEvaluationConversationDialog"
import {
  selectConversationRunsData,
  selectConversationRunsForDataset,
} from "../features/evaluation-conversation-runs/evaluation-conversation-runs.selectors"
import { EvalRoutes } from "./helpers"

export function EvaluationConversationDatasetRoute() {
  const datasetId = useAppSelector(selectCurrentConversationDatasetId)
  const dataset = useAppSelector(selectCurrentConversationDatasetData)
  const runs = useAppSelector(selectConversationRunsData)
  const outlet = useOutlet()

  useEvalLayoutWidth("wide")

  // Load the current dataset's records via middleware (ADR 0009); refreshOn
  // re-runs unmount/mount when navigating from one dataset to another in place.
  useMount({
    actions: {
      mount: evaluationConversationDatasetsActions.mountRecords,
      unmount: evaluationConversationDatasetsActions.unmountRecords,
    },
    condition: !!datasetId,
    refreshOn: [datasetId],
  })

  if (!datasetId) return <LoadingRoute />
  return <AsyncRoute data={[dataset, runs]}>{outlet ? outlet : <WithData />}</AsyncRoute>
}

function WithData() {
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const dataset = useValue(selectCurrentConversationDatasetData)
  const navigate = useNavigate()

  const handleBack = () => navigate(EvalRoutes.conversation.build({ organizationId, projectId }))

  return (
    <div>
      <GridHeader
        title={dataset.name}
        description={buildSince(dataset.updatedAt)}
        onBack={handleBack}
        action={
          <>
            <RunEvaluationConversationDialog dataset={dataset} />

            <RenameEvaluationConversationDatasetDialog
              dataset={dataset}
              buttonProps={{ variant: "outline", size: "icon" }}
            />

            <DeleteEvaluationConversationDatasetButton
              datasetId={dataset.id}
              buttonProps={{ variant: "secondary", size: "icon" }}
              onDelete={handleBack}
            />
          </>
        }
      />

      <div className="p-6">
        <div className="flex flex-col gap-6">
          <EvaluationConversationDatasetRecordList dataset={dataset} />
          <RunListWithData datasetId={dataset.id} />
        </div>
      </div>
    </div>
  )
}

function RunListWithData({ datasetId }: { datasetId: string }) {
  const runs = useValue((state) => selectConversationRunsForDataset(state, datasetId))
  return <EvaluationConversationRunHistory runs={runs} />
}
