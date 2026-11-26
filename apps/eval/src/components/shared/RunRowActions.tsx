import { Button, buttonVariants } from "@caseai-connect/app-ui/components/button"
import { ButtonGroup } from "@caseai-connect/app-ui/components/button-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@caseai-connect/app-ui/components/dropdown-menu"
import type { AgentParamsDto } from "@caseai-connect/eval-contracts"
import { fullDateTimeOf } from "@caseai-connect/frontend-lib"
import { Trans, useLingui } from "@lingui/react/macro"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { EllipsisIcon, Trash2Icon } from "lucide-react"
import type { ReactNode } from "react"

export type RunRowActionsProps = {
  agentParams: AgentParamsDto
  datasetId: string
  run: { id: string; createdAt: number }
  /** Other entries of the « ⋯ » menu, above Delete. */
  menuItems?: ReactNode
  /** Asks to delete the run, for who may; none hides the action. */
  onDelete: (() => void) | null
}

/**
 * What a row of the runs offers: Open, grouped with a « ⋯ » menu (More actions) that holds what
 * the feature adds and Delete, for who may.
 */
export function RunRowActions({
  agentParams,
  datasetId,
  run,
  menuItems,
  onDelete,
}: RunRowActionsProps) {
  const { t, i18n } = useLingui()
  const started = fullDateTimeOf(run.createdAt, i18n.locale)
  return (
    <ButtonGroup>
      <Link
        to="/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId/runs/$runId"
        params={{ ...agentParams, datasetId, runId: run.id }}
        aria-label={t`Open the run of ${started}`}
        // The group joins its parts by their slot, which a link styled as a button lacks.
        data-slot="button"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        <Trans comment="Opens a run from the list of runs">Open</Trans>
      </Link>
      {menuItems || onDelete ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={t`More actions on the run of ${started}`}
              />
            }
          >
            <EllipsisIcon aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {menuItems}
            {onDelete ? (
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2Icon aria-hidden />
                <Trans comment="Deletes a run">Delete</Trans>
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </ButtonGroup>
  )
}
