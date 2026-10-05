import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useFeatureFlags } from "@/common/hooks/use-feature-flags"
import { useMount } from "@/common/hooks/use-mount"
import { useValue } from "@/common/hooks/use-value"
import { agentMemoriesActions } from "./agent-memories.slice"

/**
 * Loads the agent's memory of the signed-in user for a conversation route,
 * when the project has agent memory. Returns whether the memory UI applies.
 */
export function useAgentMemory({ agentId }: { agentId: string }): boolean {
  const project = useValue(selectCurrentProjectData)
  const enabled = useFeatureFlags(project).hasFeature("agent-memory")
  useMount({ actions: agentMemoriesActions, condition: enabled, refreshOn: [agentId] })
  return enabled
}
