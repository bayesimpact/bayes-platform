import { Trans } from "@lingui/react/macro"
import { useStartConversation } from "../api/mutations"
import type { ConversationAgentRef } from "../conversation-ref"
import { Composer } from "./Composer"

export type NewConversationProps = {
  agent: ConversationAgentRef
  agentName: string
}

/**
 * A new conversation, before its first message, as in the Claude app: a greeting and the message
 * box. The first message creates the conversation and opens it.
 */
export function NewConversation({ agent, agentName }: NewConversationProps) {
  const startConversation = useStartConversation(agent)
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 pb-16">
      <h1 className="text-center text-3xl font-semibold tracking-tight">
        <Trans>How can I help you today?</Trans>
      </h1>
      <div className="w-full max-w-2xl">
        <Composer
          agentName={agentName}
          isBusy={startConversation.isPending}
          onSend={(content) => startConversation.mutate(content)}
        />
        {startConversation.isError ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            <Trans>The conversation could not start. Try again.</Trans>
          </p>
        ) : null}
      </div>
    </div>
  )
}
