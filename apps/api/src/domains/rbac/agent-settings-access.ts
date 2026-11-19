import type { PermissionService } from "./permission.service"
import {
  AGENT_SETTINGS_DRAFT_UPDATE_PERMISSION,
  AGENT_SETTINGS_READ_PERMISSION,
} from "./rbac.constants"

/**
 * Whether the person reads the agent's settings, every revision and the draft included: they
 * hold the reading of the settings, or they edit the draft as owner or admin of the agent.
 * One rule for every place that shows settings outside the settings history route.
 */
export async function canReadAgentSettings(
  permissionService: PermissionService,
  userId: string,
  agentId: string,
): Promise<boolean> {
  const agent = { type: "agent" as const, id: agentId }
  return (
    (await permissionService.has(userId, AGENT_SETTINGS_READ_PERMISSION, agent)) ||
    permissionService.has(userId, AGENT_SETTINGS_DRAFT_UPDATE_PERMISSION, agent)
  )
}
