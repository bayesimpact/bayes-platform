import type { ConversationParamsDto } from "@caseai-connect/desk-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
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
import { DeleteEntryDialog } from "@/features/history"
import { agentParamsOf } from "@/lib/agent-params"
import { useConversationTitle } from "../hooks/use-conversation-title"

export type ConversationMenuProps = {
  conversation: ConversationParamsDto
}

/**
 * The menu of the open conversation, at the end of the bar above it, as an extraction has: it
 * deletes the conversation after a confirmation, then opens a new one.
 */
export function ConversationMenu({ conversation }: ConversationMenuProps) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const [isDeleting, setIsDeleting] = useState(false)
  const agent = agentParamsOf(conversation)
  const title = useConversationTitle(conversation)

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
        isOpen={isDeleting}
        onOpenChange={setIsDeleting}
        onDeleted={() =>
          void navigate({ to: "/o/$organizationId/p/$projectId/a/$agentId", params: agent })
        }
      />
    </>
  )
}
