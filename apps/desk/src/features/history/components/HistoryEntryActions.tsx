import { Trans, useLingui } from "@lingui/react/macro"
import { useNavigate, useParams } from "@tanstack/react-router"
import { EllipsisIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenuAction } from "@/components/ui/sidebar"
import type { HistoryAgent, HistoryEntry } from "../history-entries"
import { DeleteEntryDialog } from "./DeleteEntryDialog"

export type HistoryEntryActionsProps = {
  agent: HistoryAgent
  entry: HistoryEntry
  /** The entry's name, as the history shows it. */
  title: string
}

/** The menu of an entry of the history, which deletes it after a confirmation. */
export function HistoryEntryActions({ agent, entry, title }: HistoryEntryActionsProps) {
  const { t } = useLingui()
  const [isConfirming, setIsConfirming] = useState(false)
  const navigate = useNavigate()
  const currentParams = useParams({ strict: false })
  const openId =
    currentParams.agentSessionId ?? currentParams.extractionRunId ?? currentParams.csvRunId

  // Deleting the open entry leaves it for a new session.
  const handleDeleted = () => {
    if (openId !== entry.id) return
    void navigate({
      to: "/o/$organizationId/p/$projectId/a/$agentId",
      params: {
        organizationId: agent.organizationId,
        projectId: agent.projectId,
        agentId: agent.agentId,
      },
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<SidebarMenuAction showOnHover aria-label={t`Actions on ${title}`} />}
        >
          <EllipsisIcon aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right">
          <DropdownMenuItem variant="destructive" onClick={() => setIsConfirming(true)}>
            <Trash2Icon aria-hidden />
            <Trans>Delete</Trans>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteEntryDialog
        agent={agent}
        entry={entry}
        title={title}
        open={isConfirming}
        onOpenChange={setIsConfirming}
        onDeleted={handleDeleted}
      />
    </>
  )
}
