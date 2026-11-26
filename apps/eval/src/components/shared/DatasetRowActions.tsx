import { Button, buttonVariants } from "@caseai-connect/app-ui/components/button"
import { ButtonGroup } from "@caseai-connect/app-ui/components/button-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@caseai-connect/app-ui/components/dropdown-menu"
import type { AgentParamsDto } from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { EllipsisIcon, PencilIcon, Trash2Icon } from "lucide-react"

export type DatasetRowActionsProps = {
  agent: AgentParamsDto
  /** The dataset of the row: its id, and its name, which names the actions. */
  dataset: { id: string; name: string }
  /** Renames the dataset, for who may; none hides the action. */
  onRename: (() => void) | null
  /** Deletes the dataset, for who may; none hides the action. */
  onDelete: (() => void) | null
}

/**
 * What a row of the datasets offers: Open, grouped with a « ⋯ » menu (More actions) that holds
 * Rename and Delete, for who may.
 */
export function DatasetRowActions({ agent, dataset, onRename, onDelete }: DatasetRowActionsProps) {
  const { t } = useLingui()
  const name = dataset.name
  return (
    <ButtonGroup>
      <Link
        to="/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId"
        params={{ ...agent, datasetId: dataset.id }}
        aria-label={t`Open ${name}`}
        // The group joins its parts by their slot, which a link styled as a button lacks.
        data-slot="button"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        <Trans comment="Opens a dataset from the list of datasets">Open</Trans>
      </Link>
      {onRename || onDelete ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="icon-sm" aria-label={t`More actions on ${name}`} />
            }
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
    </ButtonGroup>
  )
}
