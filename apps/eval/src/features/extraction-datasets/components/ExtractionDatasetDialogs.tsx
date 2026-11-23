import type { ProjectParamsDto } from "@caseai-connect/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { type DatasetAction, DatasetDialogs } from "@/components/shared/DatasetDialogs"
import {
  useCreateExtractionDataset,
  useDeleteExtractionDataset,
  useRenameExtractionDataset,
} from "../api/mutations"

export type ExtractionDatasetDialogsProps = {
  project: ProjectParamsDto
  /** The action under way, or `null` while no dialog shows. */
  action: DatasetAction | null
  onClose: () => void
  /** Called once a dataset is deleted, for a page that showed it to leave. */
  onDeleted?: () => void
}

/** The dialogs that create, rename and delete an extraction dataset. */
export function ExtractionDatasetDialogs({
  project,
  action,
  onClose,
  onDeleted,
}: ExtractionDatasetDialogsProps) {
  return (
    <DatasetDialogs
      action={action}
      onClose={onClose}
      onDeleted={onDeleted}
      createDescription={
        <Trans>
          A dataset holds the rows an evaluation gives the agent. Its records come from a CSV file,
          which you choose next.
        </Trans>
      }
      createDataset={useCreateExtractionDataset(project)}
      renameDataset={useRenameExtractionDataset(project)}
      deleteDataset={useDeleteExtractionDataset(project)}
    />
  )
}
