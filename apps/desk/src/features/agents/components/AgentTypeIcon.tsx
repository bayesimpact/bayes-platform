import type { AgentTypeDto } from "@bayes-platform/desk-contracts"
import { BotMessageSquareIcon, FileTextIcon } from "lucide-react"

export type AgentTypeIconProps = {
  type: AgentTypeDto
}

/** Tells a conversation agent from an extraction agent at a glance. */
export function AgentTypeIcon({ type }: AgentTypeIconProps) {
  return type === "extraction" ? <FileTextIcon aria-hidden /> : <BotMessageSquareIcon aria-hidden />
}
