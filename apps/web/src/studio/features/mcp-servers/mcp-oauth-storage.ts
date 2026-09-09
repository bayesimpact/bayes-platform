const STORAGE_KEY = "mcpOauthPendingContext"

export type PendingMcpOauthContext = {
  organizationId: string
  projectId: string
  mcpServerId: string
}

export function savePendingMcpOauthContext(context: PendingMcpOauthContext): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(context))
  } catch {
    // Storage unavailable (private mode): the callback will show an error instead.
  }
}

/** Reads and clears the pending context — it is single-use. */
export function takePendingMcpOauthContext(): PendingMcpOauthContext | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    window.localStorage.removeItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PendingMcpOauthContext>
    if (!parsed.organizationId || !parsed.projectId || !parsed.mcpServerId) return null
    return {
      organizationId: parsed.organizationId,
      projectId: parsed.projectId,
      mcpServerId: parsed.mcpServerId,
    }
  } catch {
    return null
  }
}
