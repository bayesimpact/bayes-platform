import type {
  AgentPermission,
  OrganizationPermission,
  ProjectPermission,
} from "@caseai-connect/api-contracts"
import { useCallback, useMemo } from "react"
import { selectAgentsDataIfInjected } from "@/common/features/agents/agents.selectors"
import { selectOrganizationsList } from "@/common/features/organizations/organizations.selectors"
import { selectMyProjectsList } from "@/common/features/projects/projects.selectors"
import { ADS } from "@/common/store/async-data-status"
import { useAppSelector } from "@/common/store/hooks"

export function useAbility() {
  const organizations = useAppSelector(selectOrganizationsList)
  const myProjects = useAppSelector(selectMyProjectsList)
  const agentsData = useAppSelector(selectAgentsDataIfInjected)

  const hasOrganizationPermission = useCallback(
    ({
      organizationId,
      permission,
    }: {
      organizationId: string | null
      permission: OrganizationPermission
    }) => {
      if (!organizationId || !organizations) return false
      const organization = organizations.find((item) => item.id === organizationId)
      return organization?.permissions.includes(permission) ?? false
    },
    [organizations],
  )

  const hasProjectPermission = useCallback(
    ({ projectId, permission }: { projectId: string | null; permission: ProjectPermission }) => {
      if (!projectId || !myProjects) return false
      const project = myProjects.find((item) => item.id === projectId)
      return project?.permissions.includes(permission) ?? false
    },
    [myProjects],
  )

  // The project's agents come with the caller's permissions on each.
  const hasAgentPermission = useCallback(
    ({ agentId, permission }: { agentId: string | null; permission: AgentPermission }) => {
      if (!agentId || !agentsData || !ADS.isFulfilled(agentsData)) return false
      const agent = agentsData.value.find((item) => item.id === agentId)
      return agent?.permissions.includes(permission) ?? false
    },
    [agentsData],
  )

  const canCreateProject = useCallback(
    ({ organizationId }: { organizationId: string | null }) =>
      hasOrganizationPermission({ organizationId, permission: "project.create" }),
    [hasOrganizationPermission],
  )

  const canRenameOrganization = useCallback(
    ({ organizationId }: { organizationId: string | null }) =>
      hasOrganizationPermission({ organizationId, permission: "organization.update" }),
    [hasOrganizationPermission],
  )

  const canAccessDesk = useCallback(
    ({ projectId }: { projectId: string | null }) =>
      hasProjectPermission({ projectId, permission: "desk.ui.read" }),
    [hasProjectPermission],
  )

  const canAccessStudio = useCallback(
    ({ projectId }: { projectId: string | null }) =>
      hasProjectPermission({ projectId, permission: "studio.ui.read" }),
    [hasProjectPermission],
  )

  const canAccessEvaluation = useCallback(
    ({ projectId }: { projectId: string | null }) =>
      hasProjectPermission({ projectId, permission: "evaluation.ui.read" }),
    [hasProjectPermission],
  )

  const canUpdateProjectMemberRole = useCallback(
    ({ projectId }: { projectId: string | null }) =>
      hasProjectPermission({ projectId, permission: "project.member.update" }),
    [hasProjectPermission],
  )

  const canRemoveProjectMembers = useCallback(
    ({ projectId }: { projectId: string | null }) =>
      hasProjectPermission({ projectId, permission: "project.member.delete" }),
    [hasProjectPermission],
  )

  const canUpdateCampaignMembers = useCallback(
    ({ projectId }: { projectId: string | null }) =>
      hasProjectPermission({ projectId, permission: "project.review_campaign.member.invite" }),
    [hasProjectPermission],
  )

  const canUpdateAgentMembers = useCallback(
    ({ agentId }: { agentId: string | null }) =>
      hasAgentPermission({ agentId, permission: "agent.member.update" }),
    [hasAgentPermission],
  )

  const canRemoveAgentMembers = useCallback(
    ({ agentId }: { agentId: string | null }) =>
      hasAgentPermission({ agentId, permission: "agent.member.delete" }),
    [hasAgentPermission],
  )

  const canAccessTester = useCallback(
    ({ projectId }: { projectId: string | null }) =>
      hasProjectPermission({ projectId, permission: "tester.ui.read" }),
    [hasProjectPermission],
  )

  const canAccessReviewer = useCallback(
    ({ projectId }: { projectId: string | null }) =>
      hasProjectPermission({ projectId, permission: "reviewer.ui.read" }),
    [hasProjectPermission],
  )

  const canManageAgent = useCallback(
    ({ agentId }: { agentId: string | null }) =>
      hasAgentPermission({ agentId, permission: "agent.update" }),
    [hasAgentPermission],
  )

  // The copy is a new agent of the project: managing the agent is not enough on its own.
  const canDuplicateAgent = useCallback(
    ({ projectId, agentId }: { projectId: string | null; agentId: string | null }) =>
      canManageAgent({ agentId }) &&
      hasProjectPermission({ projectId, permission: "agent.create" }),
    [canManageAgent, hasProjectPermission],
  )

  // Saving an agent answer as a test case adds a record to one of the project's datasets.
  const canSaveTestCase = useCallback(
    ({ projectId }: { projectId: string | null }) =>
      hasProjectPermission({ projectId, permission: "evaluation.conversation.dataset.update" }),
    [hasProjectPermission],
  )

  const canCreateEvaluationDataset = useCallback(
    ({ projectId }: { projectId: string | null }) =>
      hasProjectPermission({ projectId, permission: "evaluation.conversation.dataset.create" }),
    [hasProjectPermission],
  )

  return useMemo(
    () => ({
      abilities: {
        canAccessDesk,
        canAccessStudio,
        canAccessEvaluation,
        canCreateEvaluationDataset,
        canCreateProject,
        canDuplicateAgent,
        canManageAgent,
        canAccessTester,
        canAccessReviewer,
        canRenameOrganization,
        canSaveTestCase,
        canUpdateProjectMemberRole,
        canRemoveProjectMembers,
        canUpdateCampaignMembers,
        canUpdateAgentMembers,
        canRemoveAgentMembers,
      },
    }),
    [
      canAccessDesk,
      canAccessStudio,
      canAccessEvaluation,
      canCreateEvaluationDataset,
      canCreateProject,
      canDuplicateAgent,
      canManageAgent,
      canAccessTester,
      canAccessReviewer,
      canRenameOrganization,
      canSaveTestCase,
      canUpdateProjectMemberRole,
      canRemoveProjectMembers,
      canUpdateCampaignMembers,
      canUpdateAgentMembers,
      canRemoveAgentMembers,
    ],
  )
}
