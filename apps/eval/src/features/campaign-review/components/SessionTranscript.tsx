import type {
  CampaignSessionParamsDto,
  ConversationMessageOutputDto,
  ConversationParamsDto,
  ReviewerSessionOutputDto,
} from "@caseai-connect/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { useQuery } from "@tanstack/react-query"
import { ReadOnlyConversation } from "@/features/conversation"
import { reviewerSessionMcpAppsHtmlQueryOptions } from "../api/queries"

export type SessionTranscriptProps = {
  messages: ReviewerSessionOutputDto["transcript"]
  /** The session as a conversation, which the documents of its sources belong to. */
  conversation: ConversationParamsDto
  /** The session in its campaign, whose apps' HTML the reviewer reads. */
  session: CampaignSessionParamsDto
}

/** A transcript message as the tester's chat holds it: a reply keeps the tools it called. */
function toConversationMessage(
  message: ReviewerSessionOutputDto["transcript"][number],
): ConversationMessageOutputDto {
  return {
    id: message.id,
    role: message.role === "user" ? "user" : "assistant",
    content: message.content,
    status: "completed",
    createdAt: message.createdAt,
    toolCalls: message.toolCalls,
  }
}

/**
 * What the tester and the agent said, oldest first, as the tester's chat showed it: the same
 * messages, with the steps, sources and resources of each reply, only to read.
 */
export function SessionTranscript({ messages, conversation, session }: SessionTranscriptProps) {
  const hasApps = messages.some((message) =>
    message.toolCalls.some((toolCall) => toolCall.mcpApp !== undefined),
  )
  // useQuery: optional data, read once a reply shows an MCP App, which must not hold the
  // transcript back; each card shows the tool's text until its app runs.
  const mcpAppsHtml = useQuery({
    ...reviewerSessionMcpAppsHtmlQueryOptions(session),
    enabled: hasApps,
  })
  if (messages.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        <Trans>This session has no message.</Trans>
      </p>
    )
  }
  return (
    <ReadOnlyConversation
      conversation={conversation}
      messages={messages.map(toConversationMessage)}
      appsHtml={{ htmls: mcpAppsHtml.data ?? [], isPending: mcpAppsHtml.isPending }}
    />
  )
}
