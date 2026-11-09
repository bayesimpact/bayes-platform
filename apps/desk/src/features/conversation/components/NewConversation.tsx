import type { AgentParamsDto } from "@caseai-connect/desk-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useState } from "react"
import { toast } from "sonner"
import { Markdown } from "@/components/shared/Markdown"
import { Message, MessageContent } from "@/components/ui/message"
import { useStartConversation } from "../api/mutations"
import { Composer } from "./Composer"

export type NewConversationProps = {
  agent: AgentParamsDto
  agentName: string
  /** The message the conversation opens with, when the agent has one. */
  greetingMessage: string | null
}

/**
 * A new conversation, before its first message, as in the Claude app: the agent's greeting, or a
 * question when it has none, and the message box. The first message creates the conversation and
 * opens it, where the greeting stays as the agent's first message.
 */
export function NewConversation({ agent, agentName, greetingMessage }: NewConversationProps) {
  const { t } = useLingui()
  const startConversation = useStartConversation(agent)
  const [draft, setDraft] = useState("")
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 pb-16">
      {greetingMessage ? (
        <div className="w-full max-w-2xl">
          <h1 className="sr-only">
            <Trans>New conversation with {agentName}</Trans>
          </h1>
          <Message>
            <MessageContent className="text-base">
              <Markdown>{greetingMessage}</Markdown>
            </MessageContent>
          </Message>
        </div>
      ) : (
        <h1 className="text-center text-3xl font-semibold tracking-tight">
          <Trans>How can I help you today?</Trans>
        </h1>
      )}
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
