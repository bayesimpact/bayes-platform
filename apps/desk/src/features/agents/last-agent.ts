const LAST_AGENT_KEY = "desk.lastAgentId"

/** The agent the person last opened on this device, or `null` when storage is unavailable. */
export function readLastAgentId(): string | null {
  try {
    return window.localStorage.getItem(LAST_AGENT_KEY)
  } catch {
    // Storage can be blocked (private mode, site data off): the Desk then opens the first agent.
    return null
  }
}

/** Forgets the agent the person opened last, so the Desk opens on its first agent next time. */
export function forgetLastAgent(): void {
  try {
    window.localStorage.removeItem(LAST_AGENT_KEY)
  } catch {
    // Storage can be blocked: there is nothing to forget then.
  }
}

/** Remembers the agent the person opened, so the Desk opens on it next time. */
export function rememberLastAgent(agentId: string): void {
  try {
    window.localStorage.setItem(LAST_AGENT_KEY, agentId)
  } catch {
    // Storage can be blocked: the Desk then opens the first agent, which is fine.
  }
}
