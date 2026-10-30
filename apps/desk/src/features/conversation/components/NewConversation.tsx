import type { AgentParamsDto } from "@caseai-connect/desk-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useState } from "react"
import { toast } from "sonner"
import { useStartConversation } from "../api/mutations"
import { Composer } from "./Composer"

export type NewConversationProps = {
  agent: AgentParamsDto
  agentName: string
}

/**
 * A new conversation, before its first message, as in the Claude app: a greeting and the message
 * box. The first message creates the conversation and opens it.
 */
export function NewConversation({ agent, agentName }: NewConversationProps) {
  const { t } = useLingui()
  const startConversation = useStartConversation(agent)
  const [draft, setDraft] = useState("")
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 pb-16">
      <h1 className="text-center text-3xl font-semibold tracking-tight">
        <Trans>How can I help you today?</Trans>
      </h1>
      <div className="w-full max-w-2xl">
        <Composer
          agentName={agentName}
          content={draft}
          onContentChange={setDraft}
          isBusy={startConversation.isPending}
          onSend={(outgoing, restore) =>
            // Only the creation can fail here: a reply that fails shows in the conversation.
            startConversation.mutate(outgoing, {
              onError: () => {
                restore()
                toast.error(t`The conversation could not start. Try again.`)
              },
            })
          }
        />
      </div>
    </div>
  )
}
