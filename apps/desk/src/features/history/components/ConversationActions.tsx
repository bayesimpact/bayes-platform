import { Trans, useLingui } from "@lingui/react/macro"
import { useNavigate, useParams } from "@tanstack/react-router"
import { EllipsisIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenuAction } from "@/components/ui/sidebar"
import { useDeleteConversation } from "../api/mutations"
import type { HistoryAgent } from "../history-entries"

export type ConversationActionsProps = {
  agent: HistoryAgent
  agentSessionId: string
  title: string
}

/** The menu of a conversation in the history, which deletes it after a confirmation. */
export function ConversationActions({ agent, agentSessionId, title }: ConversationActionsProps) {
  const { t } = useLingui()
  const [isConfirming, setIsConfirming] = useState(false)
  const deleteConversation = useDeleteConversation(agent)
  const navigate = useNavigate()
  const currentParams = useParams({ strict: false })

  const handleDelete = () => {
    deleteConversation.mutate(agentSessionId, {
      onSuccess: () => {
        setIsConfirming(false)
        // Deleting the open conversation leaves it for a new one.
        if (currentParams.agentSessionId === agentSessionId) {
          void navigate({
            to: "/o/$organizationId/p/$projectId/a/$agentId",
            params: {
              organizationId: agent.organizationId,
              projectId: agent.projectId,
              agentId: agent.agentId,
            },
          })
        }
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
      <AlertDialog open={isConfirming} onOpenChange={setIsConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <Trans>Delete this conversation?</Trans>
            </AlertDialogTitle>
            <AlertDialogDescription>
              <Trans>"{title}" and its messages will be deleted. This cannot be undone.</Trans>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteConversation.isError ? (
            <p role="alert" className="text-sm text-destructive">
              <Trans>The conversation could not be deleted. Try again.</Trans>
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Trans>Cancel</Trans>
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleteConversation.isPending}
              onClick={handleDelete}
            >
              <Trans>Delete</Trans>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
