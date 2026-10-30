import type { AgentTypeDto } from "@caseai-connect/desk-contracts"
import { FileTextIcon, MessageSquareIcon } from "lucide-react"

export type AgentTypeIconProps = {
  type: AgentTypeDto
}

/** Tells a conversation agent from an extraction agent at a glance. */
export function AgentTypeIcon({ type }: AgentTypeIconProps) {
  return type === "extraction" ? <FileTextIcon aria-hidden /> : <MessageSquareIcon aria-hidden />
}
