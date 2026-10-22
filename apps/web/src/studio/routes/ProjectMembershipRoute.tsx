import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { selectMe } from "@/common/features/me/me.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useAbility } from "@/common/hooks/use-ability"
import { useMount } from "@/common/hooks/use-mount"
import { useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { LoadingRoute } from "@/common/routes/LoadingRoute"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import type { MemberResourceRoles } from "@/studio/features/project-memberships/components/member-detail/member-detail.models"
import { ProjectMemberDetail } from "@/studio/features/project-memberships/components/member-detail/ProjectMemberDetail"
import { PROJECT_OWNER_ROLE_KEY } from "@/studio/features/project-memberships/components/members-table/members-table.models"
import type { MemberResource } from "@/studio/features/project-memberships/project-memberships.models"
import {
  selectAssignableRoles,
  selectCurrentProjectMemberUserId,
  selectMemberRoles,
  selectProjectMemberships,
} from "@/studio/features/project-memberships/project-memberships.selectors"
import {
  addMemberResourceRole,
  removeMemberResourceRole,
} from "@/studio/features/project-memberships/project-memberships.thunks"
import { projectMembershipsActions } from "../features/project-memberships/project-memberships.slice"

export function ProjectMembershipRoute() {
  const memberUserId = useAppSelector(selectCurrentProjectMemberUserId)
  const memberships = useAppSelector(selectProjectMemberships)
  const memberRoles = useAppSelector(selectMemberRoles)

  useMount({
    actions: {
      mount: projectMembershipsActions.memberMount,
      unmount: projectMembershipsActions.memberUnmount,
    },
    condition: !!memberUserId,
    refreshOn: [memberUserId],
  })

  if (!memberUserId) return <LoadingRoute />
  return (
    <AsyncRoute data={[memberships, memberRoles]}>
      <WithData />
    </AsyncRoute>
  )
}

const ROLE_ERROR_KEY = {
  add: "projectMembership:memberDetail.addError",
  remove: "projectMembership:memberDetail.removeError",
} as const

function WithData() {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { abilities } = useAbility()
  const me = useValue(selectMe)
  const projectId = useAppSelector(selectCurrentProjectId)
  const memberships = useValue(selectProjectMemberships)
  const assignableRoles = useValue(selectAssignableRoles)
  const { member, workspace, agents, campaigns } = useValue(selectMemberRoles)

  const ownerCount = memberships.filter((membership) =>
    membership.roles.some((role) => role.key === PROJECT_OWNER_ROLE_KEY),
  ).length
  const isLastOwner =
    ownerCount === 1 && member.roles.some((role) => role.key === PROJECT_OWNER_ROLE_KEY)

  // What the viewer may change comes from their own permissions on each resource.
  const canManage = (resource: MemberResource) => {
    switch (resource.kind) {
      case "project":
        return abilities.canUpdateProjectMemberRole({ projectId })
      case "agent":
        return abilities.canUpdateAgentMembers({ agentId: resource.resourceId })
      case "review_campaign":
        return abilities.canUpdateCampaignMembers({ projectId }) && resource.detail !== "closed"
    }
  }

  const toResourceRoles = (resource: MemberResource): MemberResourceRoles => ({
    kind: resource.kind,
    resourceId: resource.resourceId,
    resourceName: resource.resourceName,
    detail: resource.detail
      ? t(`projectMembership:memberDetail.details.${resource.detail}`, {
          defaultValue: resource.detail,
        })
      : undefined,
    roles: resource.roles,
    grantableRoles: assignableRoles[resource.kind],
    canManage: canManage(resource),
    permissions: resource.permissions,
  })

  /** The membership row that holds the role: a campaign role is revoked by it. */
  const membershipIdOf = (resource: MemberResourceRoles, roleKey: string) =>
    [workspace, ...agents, ...campaigns]
      .find((entry) => entry.kind === resource.kind && entry.resourceId === resource.resourceId)
      ?.roles.find((role) => role.key === roleKey)?.membershipId ?? ""

  const handleAddRole = async (resource: MemberResourceRoles, roleKey: string) => {
    const result = await dispatch(
      addMemberResourceRole({ kind: resource.kind, resourceId: resource.resourceId, roleKey }),
    )
    if (addMemberResourceRole.rejected.match(result)) throw new Error(t(ROLE_ERROR_KEY.add))
  }

  const handleRemoveRole = async (resource: MemberResourceRoles, roleKey: string) => {
    const result = await dispatch(
      removeMemberResourceRole({
        kind: resource.kind,
        resourceId: resource.resourceId,
        roleKey,
        membershipId: membershipIdOf(resource, roleKey),
      }),
    )
    if (removeMemberResourceRole.rejected.match(result)) throw new Error(t(ROLE_ERROR_KEY.remove))
  }

  return (
    <ProjectMemberDetail
      member={member}
      currentUserId={me.id}
      workspace={toResourceRoles(workspace)}
      agents={agents.map(toResourceRoles)}
      campaigns={campaigns.map(toResourceRoles)}
      isLastOwner={isLastOwner}
      onAddRole={handleAddRole}
      onRemoveRole={handleRemoveRole}
      onBack={() => navigate(-1)}
    />
  )
}
