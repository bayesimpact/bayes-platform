import type { AgentParamsDto } from "@caseai-connect/desk-contracts"

/**
 * The agent's params alone, out of a wider object such as a conversation's params or an agent of
 * the history. The router needs them exact: a route's params hold its own keys and no other. The
 * API client needs no such pick, since it keeps the keys each route declares.
 */
export function agentParamsOf(source: AgentParamsDto): AgentParamsDto {
  return {
    organizationId: source.organizationId,
    projectId: source.projectId,
    agentId: source.agentId,
  }
}
