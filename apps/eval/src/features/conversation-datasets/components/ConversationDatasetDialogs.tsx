import type { ProjectParamsDto } from "@bayes-platform/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { type DatasetAction, DatasetDialogs } from "@/components/shared/DatasetDialogs"
import {
  useCreateConversationDataset,
  useDeleteConversationDataset,
  useRenameConversationDataset,
} from "../api/mutations"

export type ConversationDatasetDialogsProps = {
  project: ProjectParamsDto
  /** The action under way, or `null` while no dialog shows. */
  action: DatasetAction | null
  onClose: () => void
  /** Called once a dataset is deleted, for a page that showed it to leave. */
  onDeleted?: () => void
}

/** The dialogs that create, rename and delete a conversation dataset. */
export function ConversationDatasetDialogs({
  project,
  action,
  onClose,
  onDeleted,
}: ConversationDatasetDialogsProps) {
  return (
    <DatasetDialogs
      action={action}
      onClose={onClose}
      onDeleted={onDeleted}
      createDescription={<Trans>A dataset holds the questions an evaluation asks the agent.</Trans>}
      createDataset={useCreateConversationDataset(project)}
      renameDataset={useRenameConversationDataset(project)}
      deleteDataset={useDeleteConversationDataset(project)}
    />
  )
}
