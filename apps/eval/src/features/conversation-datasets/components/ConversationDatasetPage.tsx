import {
  type AgentParamsDto,
  type ConversationDatasetParamsDto,
  EVALUATION_CONVERSATION_DATASET_DELETE_PERMISSION,
  EVALUATION_CONVERSATION_DATASET_UPDATE_PERMISSION,
} from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { EllipsisIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"
import { BackLink } from "@/components/shared/BackLink"
import { PageContainer } from "@/components/shared/PageContainer"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { type EvaluationAgent, hasProjectPermission } from "@/features/agents"
import { fullDateTimeOf } from "@/lib/format-time"
import { projectConversationDatasetsQueryOptions } from "../api/queries"
import {
  type ConversationDatasetAction,
  ConversationDatasetDialogs,
} from "./ConversationDatasetDialogs"
import { ConversationRecordsSection } from "./ConversationRecordsSection"

export type ConversationDatasetPageProps = {
  agent: EvaluationAgent
  agentParams: AgentParamsDto
  datasetParams: ConversationDatasetParamsDto
  /** The page of records shown, counted from 0. */
  page: number
}

/** A conversation dataset: its name, which its owner changes, and its records. */
export function ConversationDatasetPage({
  agent,
  agentParams,
  datasetParams,
  page,
}: ConversationDatasetPageProps) {
  const { t, i18n } = useLingui()
  const navigate = useNavigate()
  const { data: datasets } = useSuspenseQuery(
    projectConversationDatasetsQueryOptions(datasetParams),
  )
  const [action, setAction] = useState<ConversationDatasetAction | null>(null)
  const dataset = datasets.find((candidate) => candidate.id === datasetParams.datasetId)
  // The loader found the dataset: it is missing only while its deletion leaves the page.
  if (!dataset) return null
  const can = (permission: string) => hasProjectPermission(agent.project, permission)
  const canUpdate = can(EVALUATION_CONVERSATION_DATASET_UPDATE_PERMISSION)
  const canDelete = can(EVALUATION_CONVERSATION_DATASET_DELETE_PERMISSION)
  const updated = fullDateTimeOf(dataset.updatedAt, i18n.locale)
  return (
    <PageContainer>
      <PageHeader
        back={
          <BackLink
            to="/o/$organizationId/p/$projectId/a/$agentId/evaluations"
            params={agentParams}
          >
            <Trans>Evaluations</Trans>
          </BackLink>
        }
        title={dataset.name}
        description={
          <Trans comment="Under the name of a dataset: what the page shows, and when it last changed">
            Dataset · Updated {updated}
          </Trans>
        }
        actions={
          canUpdate || canDelete ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" size="icon" aria-label={t`More actions`} />}
              >
                <EllipsisIcon aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canUpdate ? (
                  <DropdownMenuItem onClick={() => setAction({ kind: "rename", dataset })}>
                    <PencilIcon aria-hidden />
                    <Trans comment="Renames a dataset">Rename</Trans>
                  </DropdownMenuItem>
                ) : null}
                {canDelete ? (
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setAction({ kind: "delete", dataset })}
                  >
                    <Trash2Icon aria-hidden />
                    <Trans comment="Deletes a dataset">Delete</Trans>
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null
        }
      />
      <ConversationRecordsSection
        dataset={datasetParams}
        page={page}
        canEdit={canUpdate}
        onPageChange={(nextPage) =>
          void navigate({
            to: "/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId",
            params: { ...agentParams, datasetId: datasetParams.datasetId },
            search: { page: nextPage === 0 ? undefined : nextPage },
          })
        }
      />
      <ConversationDatasetDialogs
        project={datasetParams}
        action={action}
        onClose={() => setAction(null)}
        onDeleted={() =>
          void navigate({
            to: "/o/$organizationId/p/$projectId/a/$agentId/evaluations",
            params: agentParams,
          })
        }
      />
    </PageContainer>
  )
}
