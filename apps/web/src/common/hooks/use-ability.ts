import { useCallback, useMemo } from "react"
import {
  selectAgentMemberships,
  selectIsPremiumMember,
  selectOrganizationMemberships,
  selectProjectMemberships,
} from "@/common/features/me/me.selectors"
import { useAppSelector } from "@/common/store/hooks"
import { SUPER_ROLES } from "../features/me/me.models"

export function useAbility() {
  const organizationMemberships = useAppSelector(selectOrganizationMemberships)
  const projectMemberships = useAppSelector(selectProjectMemberships)
  const agentMemberships = useAppSelector(selectAgentMemberships)

  const canCreateProject = useCallback(
    ({ organizationId }: { organizationId: string | null }) => {
      if (!organizationId) return false
      const isOrganizationOwnerOrAdmin = [...(organizationMemberships ?? [])].some(
        (membership) =>
          membership.organizationId === organizationId && SUPER_ROLES.includes(membership.role),
      )

      return isOrganizationOwnerOrAdmin
    },
    [organizationMemberships],
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
      abilities: { canAccessStudio, canCreateProject, canManageAgent },
      isPremiumMember,
    }),
    [canAccessStudio, canCreateProject, canManageAgent, isPremiumMember],
  )
}
