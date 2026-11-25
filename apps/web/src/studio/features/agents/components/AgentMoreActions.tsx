import { Button } from "@bayes-platform/ui/shad/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@bayes-platform/ui/shad/dropdown-menu"
import { CopyIcon, EllipsisIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import type { Agent } from "@/common/features/agents/agents.models"
import { AgentDeletorDialog } from "./AgentDeletor"
import { AgentDuplicatorDialog } from "./AgentDuplicator"

/**
 * The "More" menu of the agent page: the actions used less often (duplicate, delete), kept
 * out of the header's first row. Each opens its own dialog.
 */
export function AgentMoreActions({
  organizationId,
  agent,
  canDuplicate,
}: {
  organizationId: string
  agent: Agent
  canDuplicate: boolean
}) {
  const { t } = useTranslation()
  const [openDialog, setOpenDialog] = useState<"duplicate" | "delete" | null>(null)
  const closeDialog = () => setOpenDialog(null)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label={t("actions:more")}>
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canDuplicate && (
            <DropdownMenuItem onSelect={() => setOpenDialog("duplicate")}>
              <CopyIcon />
              {t("actions:duplicate")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem variant="destructive" onSelect={() => setOpenDialog("delete")}>
            <Trash2Icon />
            {t("actions:delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AgentDuplicatorDialog
        organizationId={organizationId}
        agent={agent}
        open={openDialog === "duplicate"}
        onClose={closeDialog}
      />
      <AgentDeletorDialog
        organizationId={organizationId}
        agent={agent}
        open={openDialog === "delete"}
        onClose={closeDialog}
      />
    </>
  )
}
