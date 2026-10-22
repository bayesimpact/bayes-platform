import type { TimeType } from "@caseai-connect/api-contracts"
import type { ProjectRole } from "@/studio/features/project-memberships/project-memberships.models"

/** A person with access to the agent, with every member role they hold on it. */
export type AgentMembership = {
  agentId: string
  userId: string
  userName: string | null
  userEmail: string
  /** False while the member was added by email and has never signed in. */
  userHasSignedIn: boolean
  createdAt: TimeType
  roles: ProjectRole[]
}
