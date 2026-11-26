import { isApplePlatform } from "@caseai-connect/frontend-lib"
import { useNavigate } from "@tanstack/react-router"
import { type ReactNode, useEffect, useState } from "react"
import { AgentCommandCenterContext } from "../agent-command-center-context"
import { type DeskAgent, flattenDeskAgents } from "../desk-agents"
import { agentPathParams } from "../find-agent"
import { useDeskAgentGroups } from "../hooks/use-desk-agent-groups"
import { AgentCommandCenter } from "./AgentCommandCenter"

export type AgentCommandCenterProviderProps = {
  /** The agent whose pages show. */
  currentAgent: DeskAgent
  children: ReactNode
}

/**
 * Gives an agent's pages the command center that switches agent, which ⌘K opens (Ctrl+K outside
 * Apple systems), and so do the buttons that read `useOpenAgentCommandCenter`. A person with a
 * single agent gets none: no dialog, and the shortcut stays the browser's.
 */
export function AgentCommandCenterProvider({
  currentAgent,
  children,
}: AgentCommandCenterProviderProps) {
  const groups = useDeskAgentGroups()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const hasSeveralAgents = flattenDeskAgents(groups).length > 1

  // The shortcut is a key of the window, which an effect subscribes to.
  useEffect(() => {
    if (!hasSeveralAgents) return
    const handleKeyDown = (event: KeyboardEvent) => {
      const hasModifier = isApplePlatform() ? event.metaKey : event.ctrlKey
      if (!hasModifier || event.altKey || event.shiftKey || event.key.toLowerCase() !== "k") return
      event.preventDefault()
      setIsOpen((wasOpen) => !wasOpen)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [hasSeveralAgents])

  const handleSelect = (agent: DeskAgent) => {
    setIsOpen(false)
    if (agent.id === currentAgent.id) return
    void navigate({
      to: "/o/$organizationId/p/$projectId/a/$agentId",
      params: agentPathParams(agent),
    })
  }

  return (
    <AgentCommandCenterContext value={hasSeveralAgents ? () => setIsOpen(true) : null}>
      {children}
      {hasSeveralAgents ? (
        <AgentCommandCenter
          groups={groups}
          currentAgentId={currentAgent.id}
          isOpen={isOpen}
          onOpenChange={setIsOpen}
          onSelect={handleSelect}
        />
      ) : null}
    </AgentCommandCenterContext>
  )
}
