import type { AgentTypeDto } from "@caseai-connect/eval-contracts"
import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"

/** The name of each kind of agent, as a campaign's pages show it. */
export const AGENT_TYPE_LABELS = {
  conversation: msg`Conversational agent`,
  extraction: msg`Extraction agent`,
} satisfies Record<AgentTypeDto, MessageDescriptor>
