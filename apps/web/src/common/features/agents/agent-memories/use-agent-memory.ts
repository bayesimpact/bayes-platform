import { useMount } from "@/common/hooks/use-mount"
import { agentMemoriesActions } from "./agent-memories.slice"

/** Loads the agent's memory of the signed-in user for a conversation route. */
export function useAgentMemory({ agentId }: { agentId: string }) {
  useMount({ actions: agentMemoriesActions, refreshOn: [agentId] })
}
