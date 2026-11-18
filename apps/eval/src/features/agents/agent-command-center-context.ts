import { createContext, use } from "react"

/** Opens the command center, or `null` for a person with a single agent, who has none. */
export const AgentCommandCenterContext = createContext<(() => void) | null>(null)

/**
 * The way to open the command center that switches agent, for the buttons that show it. `null`
 * when the person has one agent: there is nothing to switch to.
 */
export function useOpenAgentCommandCenter(): (() => void) | null {
  return use(AgentCommandCenterContext)
}
