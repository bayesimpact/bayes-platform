import type { AgentParamsDto } from "@caseai-connect/desk-contracts"
import { Plural } from "@lingui/react/macro"
import { useQuery } from "@tanstack/react-query"
import { BrainIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { memoriesQueryOptions } from "../api/queries"

export type MemoryButtonProps = {
  agent: AgentParamsDto
  isOpen: boolean
  onToggle: () => void
}

/**
 * The button that opens what the agent remembers, with how many facts. Hidden when the agent
 * remembers nothing, or the person cannot read its memory.
 */
export function MemoryButton({ agent, isOpen, onToggle }: MemoryButtonProps) {
  // useQuery: optional data, shown as a button once known; a 403 hides it without an error page.
  const { data: memories = [] } = useQuery(memoriesQueryOptions(agent))
  if (memories.length === 0 && !isOpen) return null
  const count = memories.length
  return (
    <Button
      variant={isOpen ? "secondary" : "outline"}
      size="sm"
      aria-pressed={isOpen}
      onClick={onToggle}
    >
      <BrainIcon aria-hidden />
      <Plural value={count} one="Memory (#)" other="Memory (#)" />
    </Button>
  )
}
