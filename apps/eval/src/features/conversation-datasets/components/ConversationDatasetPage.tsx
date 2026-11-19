import {
  type AgentParamsDto,
  type ConversationDatasetParamsDto,
  EVALUATION_CONVERSATION_DATASET_DELETE_PERMISSION,
  EVALUATION_CONVERSATION_DATASET_UPDATE_PERMISSION,
  EVALUATION_CONVERSATION_RUN_CREATE_PERMISSION,
  EVALUATION_CONVERSATION_RUN_DELETE_PERMISSION,
} from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { cn } from "cn"
import { EllipsisIcon, PencilIcon, PlayIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"
import { BackLink } from "@/components/shared/BackLink"
import { PageContainer } from "@/components/shared/PageContainer"
import { PageHeader } from "@/components/shared/PageHeader"
import { TimeAgo } from "@/components/shared/TimeAgo"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { type EvaluationAgent, hasProjectPermission } from "@/features/agents"
import { ConversationRunsSection } from "@/features/conversation-runs"
import { projectConversationDatasetsQueryOptions } from "../api/queries"
import type { ConversationDatasetTab } from "../schemas"
import {
  type ConversationDatasetAction,
  ConversationDatasetDialogs,
} from "./ConversationDatasetDialogs"
import { ConversationRecordsSection } from "./ConversationRecordsSection"

export type ConversationDatasetPageProps = {
  agent: EvaluationAgent
  agentParams: AgentParamsDto
  datasetParams: ConversationDatasetParamsDto
  /** The tab shown: the dataset's records, or its runs. */
  tab: ConversationDatasetTab
}

/**
 * A conversation dataset: its name, which its owner changes, its records and its runs, in two
 * tabs, with the way to a new evaluation of the agent on it.
 */
export function ConversationDatasetPage({
  agent,
  agentParams,
  datasetParams,
  tab,
}: ConversationDatasetPageProps) {
  const { t } = useLingui()
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
  const canRun = can(EVALUATION_CONVERSATION_RUN_CREATE_PERMISSION)
  const datasetPage = {
    to: "/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId",
    params: { ...agentParams, datasetId: datasetParams.datasetId },
  } as const
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
            Dataset · Updated <TimeAgo moment={dataset.updatedAt} />
          </Trans>
        }
        actions={
          <>
            {canRun && dataset.recordCount > 0 ? (
              <Link
                to="/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId/runs/new"
                params={datasetPage.params}
                className={cn(buttonVariants())}
              >
                <PlayIcon data-icon="inline-start" aria-hidden />
                <Trans comment="Opens the page that starts an evaluation of the agent on a dataset">
                  Run evaluation
                </Trans>
              </Link>
            ) : null}
            {canRun && dataset.recordCount === 0 ? (
              <Button disabled title={t`Add a record first.`}>
                <PlayIcon data-icon="inline-start" aria-hidden />
                <Trans comment="Opens the page that starts an evaluation of the agent on a dataset">
                  Run evaluation
                </Trans>
              </Button>
            ) : null}
            {canUpdate || canDelete ? (
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
            ) : null}
          </>
        }
      />
      <Tabs
        value={tab}
        onValueChange={(value) =>
          void navigate({ ...datasetPage, search: { tab: value === "runs" ? "runs" : undefined } })
        }
      >
        <TabsList>
          <TabsTrigger value="records">
            <Trans comment="The tab with the records of a dataset">Records</Trans>
          </TabsTrigger>
          <TabsTrigger value="runs">
            <Trans comment="The tab with the runs of a dataset">Runs</Trans>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "runs" ? (
        <ConversationRunsSection
          agentParams={agentParams}
          agentName={agent.name}
          dataset={datasetParams}
          canDelete={can(EVALUATION_CONVERSATION_RUN_DELETE_PERMISSION)}
        />
      ) : (
        <ConversationRecordsSection dataset={datasetParams} canEdit={canUpdate} />
      )}
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
