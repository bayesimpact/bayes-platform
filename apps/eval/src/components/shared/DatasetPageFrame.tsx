import type { AgentParamsDto } from "@bayes-platform/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { Link, useNavigate } from "@tanstack/react-router"
import { cn } from "cn"
import { EllipsisIcon, PencilIcon, PlayIcon, Trash2Icon } from "lucide-react"
import type { ReactNode } from "react"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BackLink } from "./BackLink"
import { PageContainer } from "./PageContainer"
import { PageHeader } from "./PageHeader"
import { SplitPage } from "./SplitPage"
import { TimeAgo } from "./TimeAgo"

/** A tab of a dataset's page. */
export type DatasetTab = "records" | "runs"

export type DatasetPageFrameProps = {
  agentParams: AgentParamsDto
  dataset: { id: string; name: string; updatedAt: number }
  /**
   * The tab shown, of the records and the runs, or `null` for a dataset that has neither yet: the
   * page then shows what sets it up, with no tab.
   */
  tab: DatasetTab | null
  /**
   * Whether the person starts evaluations, and why they cannot start one on this dataset now, if
   * so: `null` hides the action.
   */
  run: { disabledReason: string | null } | null
  /** Renames the dataset, for who may; none hides the action. */
  onRename: (() => void) | null
  /** Deletes the dataset, for who may; none hides the action. */
  onDelete: (() => void) | null
  /** Whether the page takes all the width there is, for a table with a column per data column. */
  isWide?: boolean
  /**
   * The side panel that starts an evaluation on the dataset, which the `run` search param
   * shows: the feature gives the form, and takes what closes the panel.
   */
  runPanel?: ((onClose: () => void) => ReactNode) | null
  /** The tab's content, then the page's dialogs. */
  children: ReactNode
}

/**
 * The frame of a dataset's page, for an agent of any type: the way back to the datasets, its name
 * and when it last changed, the way to a new evaluation on it, which opens in a side panel, what
 * changes it, and its two tabs.
 */
export function DatasetPageFrame({
  agentParams,
  dataset,
  tab,
  run,
  onRename,
  onDelete,
  isWide = false,
  runPanel = null,
  children,
}: DatasetPageFrameProps) {
  const { t } = useLingui()
  const navigate = useNavigate()
  // The frame shows on the dataset's own route: its search params are that route's.
  const datasetPage = {
    from: "/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId/",
    to: "/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId",
    params: { ...agentParams, datasetId: dataset.id },
  } as const
  const runLabel = (
    <>
      <PlayIcon data-icon="inline-start" aria-hidden />
      <Trans comment="Opens the page that starts an evaluation of the agent on a dataset">
        Run evaluation
      </Trans>
    </>
  )
  return (
    <SplitPage
      panel={
        runPanel
          ? runPanel(
              () =>
                void navigate({
                  ...datasetPage,
                  search: (previous) => ({ ...previous, run: undefined }),
                }),
            )
          : null
      }
    >
      <PageContainer isWide={isWide}>
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
              {run && run.disabledReason === null ? (
                <Link
                  {...datasetPage}
                  // The form opens beside the page, which stays as it is. While it shows, the
                  // button is gray, as the toggle of any side panel, and closes it.
                  search={(previous) => ({ ...previous, run: runPanel ? undefined : true })}
                  className={cn(buttonVariants({ variant: runPanel ? "secondary" : "default" }))}
                >
                  {runLabel}
                </Link>
              ) : null}
              {run && run.disabledReason !== null ? (
                <Button disabled title={run.disabledReason}>
                  {runLabel}
                </Button>
              ) : null}
              {onRename || onDelete ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button variant="outline" size="icon" aria-label={t`More actions`} />}
                  >
                    <EllipsisIcon aria-hidden />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onRename ? (
                      <DropdownMenuItem onClick={onRename}>
                        <PencilIcon aria-hidden />
                        <Trans comment="Renames a dataset">Rename</Trans>
                      </DropdownMenuItem>
                    ) : null}
                    {onDelete ? (
                      <DropdownMenuItem variant="destructive" onClick={onDelete}>
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
        {tab ? (
          <Tabs
            value={tab}
            onValueChange={(value) =>
              void navigate({
                ...datasetPage,
                // Another tab starts its table afresh; the panel that starts a run stays.
                search: (previous) => ({
                  tab: value === "runs" ? "runs" : undefined,
                  run: previous.run,
                }),
              })
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
        ) : null}
        {children}
      </PageContainer>
    </SplitPage>
  )
}
