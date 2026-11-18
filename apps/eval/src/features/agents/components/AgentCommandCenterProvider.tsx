import { useNavigate, useParams, useSearch } from "@tanstack/react-router"
import { type ReactNode, useEffect, useState } from "react"
import { isApplePlatform } from "@/lib/platform"
import { AgentCommandCenterContext } from "../agent-command-center-context"
import { type EvaluationAgent, flattenEvaluationAgents } from "../evaluation-agents"
import { agentPathParams } from "../find-agent"
import { useEvaluationWorkspace } from "../hooks/use-evaluation-workspace"
import { AgentCommandCenter } from "./AgentCommandCenter"

export type AgentCommandCenterProviderProps = {
  children: ReactNode
}

/**
 * Gives every signed-in page the command center that switches agent, which ⌘K opens (Ctrl+K
 * outside Apple systems), and so do the buttons that read `useOpenAgentCommandCenter` and an
 * agent's URL with `switchAgent`, where the app's home sends a person with several agents. A
 * person with a single agent gets none: no dialog, and the shortcut stays the browser's.
 */
export function AgentCommandCenterProvider({ children }: AgentCommandCenterProviderProps) {
  const { groups } = useEvaluationWorkspace()
  const navigate = useNavigate()
  const { agentId } = useParams({ strict: false })
  const isAskedByUrl = useSearch({ strict: false, select: (search) => search.switchAgent === true })
  const [isOpenedHere, setIsOpenedHere] = useState(false)
  const hasSeveralAgents = flattenEvaluationAgents(groups).length > 1
  const isOpen = isOpenedHere || isAskedByUrl

  // The shortcut is a key of the window, which an effect subscribes to.
  useEffect(() => {
    if (!hasSeveralAgents) return
    const handleKeyDown = (event: KeyboardEvent) => {
      const hasModifier = isApplePlatform() ? event.metaKey : event.ctrlKey
      if (!hasModifier || event.altKey || event.shiftKey || event.key.toLowerCase() !== "k") return
      event.preventDefault()
      setIsOpenedHere((wasOpen) => !wasOpen)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [hasSeveralAgents])

  /** Forgets the URL's request, so the page shows without the dialog, and a reload too. */
  const forgetUrlRequest = () =>
    navigate({
      to: ".",
      search: (previous) => ({ ...previous, switchAgent: undefined }),
      replace: true,
    })

  const handleOpenChange = (isNowOpen: boolean) => {
    setIsOpenedHere(isNowOpen)
    if (!isNowOpen && isAskedByUrl) void forgetUrlRequest()
  }

  const handleSelect = (agent: EvaluationAgent) => {
    setIsOpenedHere(false)
    if (agent.id === agentId) {
      if (isAskedByUrl) void forgetUrlRequest()
      return
    }
    // The page the home opened with the dialog was only a step: the agent chosen takes its place.
    void navigate({
      to: "/o/$organizationId/p/$projectId/a/$agentId",
      params: agentPathParams(agent),
      replace: isAskedByUrl,
    })
  }

  return (
    <AgentCommandCenterContext value={hasSeveralAgents ? () => setIsOpenedHere(true) : null}>
      {children}
      {hasSeveralAgents ? (
        <AgentCommandCenter
          groups={groups}
          currentAgentId={agentId}
          isOpen={isOpen}
          onOpenChange={handleOpenChange}
          onSelect={handleSelect}
        />
      ) : null}
    </AgentCommandCenterContext>
  )
}
