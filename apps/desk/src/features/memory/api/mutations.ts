import type { AgentParamsDto } from "@caseai-connect/desk-contracts"
import {
  DeskMemoriesRoutes,
  type ResolveMemoryProposalsInputDto,
} from "@caseai-connect/desk-contracts"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { invalidateMemories } from "./queries"

/** Forgets one fact the agent remembers. */
export function useForgetMemory(agent: AgentParamsDto) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (memoryId: string) =>
      apiRequest(DeskMemoriesRoutes.deleteOne, { params: { ...agent, memoryId } }),
    onSettled: () => invalidateMemories(queryClient, agent.agentId),
  })
}

/** Forgets every fact the agent remembers about the person. */
export function useForgetAllMemories(agent: AgentParamsDto) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiRequest(DeskMemoriesRoutes.deleteAll, { params: agent }),
    onSettled: () => invalidateMemories(queryClient, agent.agentId),
  })
}

/** Saves, rewords or rejects facts the agent proposed to remember. */
export function useResolveMemoryProposals(agent: AgentParamsDto) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (decisions: ResolveMemoryProposalsInputDto["decisions"]) =>
      apiRequest(DeskMemoriesRoutes.resolveProposals, { params: agent, body: { decisions } }),
    onSettled: () => invalidateMemories(queryClient, agent.agentId),
  })
}
