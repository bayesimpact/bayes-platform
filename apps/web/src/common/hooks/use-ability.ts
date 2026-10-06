import type { OrganizationPermission, ProjectPermission } from "@caseai-connect/api-contracts"
import { useCallback, useMemo } from "react"
import {
  selectAgentMemberships,
  selectReviewCampaignMemberships,
} from "@/common/features/me/me.selectors"
import { selectOrganizationsList } from "@/common/features/organizations/organizations.selectors"
import { selectMyProjectsList } from "@/common/features/projects/projects.selectors"
import { useAppSelector } from "@/common/store/hooks"
import { SUPER_ROLES } from "../features/me/me.models"

export function useAbility() {
  const organizations = useAppSelector(selectOrganizationsList)
  const myProjects = useAppSelector(selectMyProjectsList)
  const agentMemberships = useAppSelector(selectAgentMemberships)
  const reviewCampaignMemberships = useAppSelector(selectReviewCampaignMemberships)

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

  const canAccessTester = useCallback(
    ({ projectId }: { projectId: string | null }) =>
      !!reviewCampaignMemberships?.some(
        (membership) =>
          membership.role === "tester" &&
          membership.campaignStatus === "active" &&
          membership.projectId === projectId,
      ),
    [reviewCampaignMemberships],
  )

  const canAccessReviewer = useCallback(
    ({ projectId }: { projectId: string | null }) =>
      !!reviewCampaignMemberships?.some(
        (membership) =>
          membership.role === "reviewer" &&
          membership.campaignStatus !== "draft" &&
          membership.projectId === projectId,
      ),
    [reviewCampaignMemberships],
  )

  const canManageAgent = useCallback(
    ({ agentId }: { agentId: string | null }) => {
      const isAgentOwnerOrAdmin = [...(agentMemberships ?? [])].some(
        (membership) => membership.agentId === agentId && SUPER_ROLES.includes(membership.role),
      )
      return isAgentOwnerOrAdmin
    },
    [agentMemberships],
  )

  return useMemo(
    () => ({
      abilities: {
        canAccessDesk,
        canAccessStudio,
        canAccessEvaluation,
        canCreateProject,
        canManageAgent,
        canAccessTester,
        canAccessReviewer,
        canRenameOrganization,
        canUpdateProjectMemberRole,
      },
    }),
    [
      canAccessDesk,
      canAccessStudio,
      canAccessEvaluation,
      canCreateProject,
      canManageAgent,
      canAccessTester,
      canAccessReviewer,
      canRenameOrganization,
      canUpdateProjectMemberRole,
    ],
  )
}
