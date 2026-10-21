import { Trans, useLingui } from "@lingui/react/macro"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { EllipsisIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { conversationsQueryOptions, DeleteEntryDialog } from "@/features/history"
import type { ConversationRef } from "../conversation-ref"

export type ConversationMenuProps = {
  conversation: ConversationRef
}

/**
 * The menu of the open conversation, at the end of the bar above it, as an extraction has: it
 * deletes the conversation after a confirmation, then opens a new one.
 */
export function ConversationMenu({ conversation }: ConversationMenuProps) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const [isDeleting, setIsDeleting] = useState(false)
  const agent = {
    organizationId: conversation.organizationId,
    projectId: conversation.projectId,
    agentId: conversation.agentId,
  }
  // useQuery: the history's list, which the sidebar loads, only names the conversation.
  const { data: conversations = [] } = useQuery(
    conversationsQueryOptions({ ...agent, type: "conversation" }),
  )
  const title =
    conversations.find((candidate) => candidate.id === conversation.agentSessionId)?.title ??
    t`New conversation`

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label={t`More actions`} />}
        >
          <EllipsisIcon aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onClick={() => setIsDeleting(true)}>
            <Trash2Icon aria-hidden />
            <Trans>Delete the conversation</Trans>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteEntryDialog
        agent={agent}
        entry={{ kind: "conversation", id: conversation.agentSessionId }}
        title={title}
        open={isDeleting}
        onOpenChange={setIsDeleting}
        onDeleted={() =>
          void navigate({ to: "/o/$organizationId/p/$projectId/a/$agentId", params: agent })
        }
      />
    </>
  )
}
