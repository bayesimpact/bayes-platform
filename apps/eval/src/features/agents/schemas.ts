import { z } from "zod"

/**
 * The search params of an agent's pages and of a campaign's. `switchAgent` opens the command
 * center that switches agent, as the app's home does for a person with several agents, so they
 * land on one and can go elsewhere at once.
 */
export const agentSearchSchema = z.object({
  switchAgent: z.boolean().optional().catch(undefined),
})
