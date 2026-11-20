import type { AgentParamsDto } from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useNavigate } from "@tanstack/react-router"
import { EllipsisIcon, RotateCwIcon, Trash2Icon } from "lucide-react"
import { type ReactNode, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { durationOf, fullDateTimeOf } from "@/lib/format-time"
import { isRunActive, type RunSummary } from "@/lib/run-status"
import { shortIdOf } from "@/lib/short-id"
import { BackLink } from "./BackLink"
import { ConfirmDialog } from "./ConfirmDialog"
import { DeleteRunDialog } from "./DeleteRunDialog"
import type { MutationLike } from "./mutation-like"
import { PageHeader } from "./PageHeader"
import { RunStatusBadge } from "./RunStatusBadge"
import { SidePanelToggle } from "./SidePanelToggle"

export type RunPageHeaderProps = {
  agentParams: AgentParamsDto
  datasetId: string
  run: RunSummary
  /** Under the title: the dataset the run asked, the agent and its version. */
  description: ReactNode
  /** The side panel of the page: whether it shows, and the name of what it holds. */
  panel: { isOpen: boolean; onToggle: () => void; label: ReactNode }
  /** Other entries of the « ⋯ » menu, above Retry and Delete. */
  menuItems?: ReactNode
  /** Stops the run, for who may; none hides the action. */
  cancelRun: MutationLike<string> | null
  /** Asks again the records that failed, for who may and when some did; none hides the action. */
  retryRun: MutationLike<string> | null
  /** Deletes the run, for who may; none hides the action. */
  deleteRun: MutationLike<string> | null
}

/**
 * The top of a run's page, for an agent of any type: the way back to the runs of its dataset, its
 * id, when it started, where it stands, how long it took, and what a person does with it: open
 * the side panel, stop it, ask its failures again, delete it.
 */
export function RunPageHeader({
  agentParams,
  datasetId,
  run,
  description,
  panel,
  menuItems,
  cancelRun,
  retryRun,
  deleteRun,
}: RunPageHeaderProps) {
  const { t, i18n } = useLingui()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState<"cancel" | "delete" | null>(null)
  const isActive = isRunActive(run.status)
  const datasetRuns = {
    to: "/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId",
    params: { ...agentParams, datasetId },
    search: { tab: "runs" },
  } as const
  const started = fullDateTimeOf(run.createdAt, i18n.locale)
  const runId = shortIdOf(run.id)
  // From its creation to its last change: a run that is over changes no more.
  const took = durationOf(run.updatedAt - run.createdAt, i18n.locale)
  return (
    <>
      <PageHeader
        back={
          <BackLink {...datasetRuns}>
            <Trans comment="The link back from a run to the runs of its dataset">Runs</Trans>
          </BackLink>
        }
        title={
          <Trans comment="The title of a run's page, by when it started">Run of {started}</Trans>
        }
        eyebrow={
          <Badge
            variant="outline"
            className="font-mono"
            title={run.id}
            aria-label={t`Run ${runId}`}
          >
            {runId}
          </Badge>
        }
        badge={
          <>
            <RunStatusBadge status={run.status} />
            {isActive ? null : (
              <Badge variant="outline">
                <Trans comment="How long a run took, such as: Took 2 min 5 sec">Took {took}</Trans>
              </Badge>
            )}
          </>
        }
        description={description}
        actions={
          <>
            <SidePanelToggle isOpen={panel.isOpen} onToggle={panel.onToggle}>
              {panel.label}
            </SidePanelToggle>
            {cancelRun && isActive ? (
              <Button variant="outline" onClick={() => setConfirming("cancel")}>
                <Trans comment="Stops a run under way">Cancel the run</Trans>
              </Button>
            ) : null}
            {menuItems || retryRun || deleteRun ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="outline" size="icon" aria-label={t`More actions`} />}
                >
                  <EllipsisIcon aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {menuItems}
                  {retryRun ? (
                    <DropdownMenuItem
                      disabled={retryRun.isPending}
                      onClick={() =>
                        retryRun.mutate(run.id, {
                          onSuccess: () => toast.success(t`The run started again.`),
                          onError: () => toast.error(t`The run could not start again. Try again.`),
                        })
                      }
                    >
                      <RotateCwIcon aria-hidden />
                      <Trans comment="Asks again the records of a run that failed">Retry</Trans>
                    </DropdownMenuItem>
                  ) : null}
                  {deleteRun ? (
                    <DropdownMenuItem variant="destructive" onClick={() => setConfirming("delete")}>
                      <Trash2Icon aria-hidden />
                      <Trans comment="Deletes a run">Delete</Trans>
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </>
        }
      />
      {cancelRun ? (
        <ConfirmDialog
          isOpen={confirming === "cancel"}
          onOpenChange={(isOpen) => setConfirming(isOpen ? "cancel" : null)}
          title={<Trans>Cancel this run?</Trans>}
          description={
            <Trans>
              The records not asked yet stay without an answer. The answers already graded are kept.
            </Trans>
          }
          confirmLabel={<Trans comment="Stops a run under way">Cancel the run</Trans>}
          dismissLabel={
            <Trans comment="Gives up cancelling a run under way">Keep it running</Trans>
          }
          isDestructive
          isPending={cancelRun.isPending}
          onConfirm={() =>
            cancelRun.mutate(run.id, {
              onSuccess: () => {
                toast.success(t`The run was cancelled.`)
                setConfirming(null)
              },
              onError: () => toast.error(t`The run could not be cancelled. Try again.`),
            })
          }
        />
      ) : null}
      {deleteRun ? (
        <DeleteRunDialog
          runId={confirming === "delete" ? run.id : null}
          onClose={() => setConfirming(null)}
          deleteRun={deleteRun}
          onDeleted={() => void navigate(datasetRuns)}
        />
      ) : null}
    </>
  )
}
