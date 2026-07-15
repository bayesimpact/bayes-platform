import type { OrganizationPermission } from "@caseai-connect/api-contracts"
import { useCallback, useMemo } from "react"
import {
  selectAgentMemberships,
  selectIsPremiumMember,
  selectProjectMemberships,
  selectReviewCampaignMemberships,
} from "@/common/features/me/me.selectors"
import { selectOrganizationsList } from "@/common/features/organizations/organizations.selectors"
import { useAppSelector } from "@/common/store/hooks"
import { SUPER_ROLES } from "../features/me/me.models"

export function useAbility() {
  const organizations = useAppSelector(selectOrganizationsList)
  const projectMemberships = useAppSelector(selectProjectMemberships)
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

  const canAccessStudio = useCallback(
    ({ projectId }: { projectId: string | null }) => {
      const isProjectOwnerOrAdmin = [...(projectMemberships ?? [])].some(
        (membership) => membership.projectId === projectId && SUPER_ROLES.includes(membership.role),
      )
      return isProjectOwnerOrAdmin
    },
    [projectMemberships],
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

  const isPremiumMember = useAppSelector(selectIsPremiumMember)
  return useMemo(
    () => ({
      abilities: {
        canAccessStudio,
        canCreateProject,
        canManageAgent,
        canAccessTester,
        canAccessReviewer,
        canRenameOrganization,
      },
      isPremiumMember,
    }),
    [
      canAccessStudio,
      canCreateProject,
      canManageAgent,
      canAccessTester,
      canAccessReviewer,
      canRenameOrganization,
      isPremiumMember,
    ],
  )
}
