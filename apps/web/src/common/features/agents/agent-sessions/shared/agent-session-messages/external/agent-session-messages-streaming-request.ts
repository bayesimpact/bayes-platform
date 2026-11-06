import {
  AgentSessionMessagesRoutes,
  type ConversationAgentSessionTypeDto,
} from "@caseai-connect/api-contracts"

/**
 * The stream is a POST: the URL holds ids only and the message travels in the body, so a long
 * message never hits a proxy's URL limit and never lands in an access log. Each session type has
 * its own stream route, so `type` must be the session's own.
 *
 * The conditional spread on `agentSettingsRevision` keeps the object honest for anything reading
 * it here; it makes no difference on the wire, since `JSON.stringify` drops `undefined` values
 * either way and the API cannot tell an omitted field from one explicitly set to `undefined`.
 */
export function buildStreamRequest({
  baseURL,
  type,
  organizationId,
  projectId,
  agentId,
  agentSessionId,
  content,
  attachmentDocumentId,
  agentSettingsRevision,
}: {
  baseURL: string
  type: ConversationAgentSessionTypeDto
  organizationId: string
  projectId: string
  agentId: string
  agentSessionId: string
  content: string
  attachmentDocumentId?: string
  agentSettingsRevision?: number
}): { url: string; body: typeof AgentSessionMessagesRoutes.live.stream.request } {
  const body = {
    payload: {
      content,
      attachmentDocumentId,
      ...(agentSettingsRevision !== undefined && { agentSettingsRevision }),
    },
  } satisfies typeof AgentSessionMessagesRoutes.live.stream.request
  const path = AgentSessionMessagesRoutes[type].stream.getPath({
    organizationId,
    projectId,
    agentId,
    agentSessionId,
  })
  return { url: `${baseURL}${path}`, body }
}
