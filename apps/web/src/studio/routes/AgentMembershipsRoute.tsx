import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import {
  selectCurrentAgentData,
  selectCurrentAgentId,
} from "@/common/features/agents/agents.selectors"
import { selectMe } from "@/common/features/me/me.selectors"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { useAbility } from "@/common/hooks/use-ability"
import { useGetAgentRoute } from "@/common/hooks/use-get-path"
import { useMount } from "@/common/hooks/use-mount"
import { useCurrentId, useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import {
  selectAgentAssignableRoles,
  selectAgentMemberships,
  selectAgentPendingInvitations,
} from "@/studio/features/agent-memberships/agent-memberships.selectors"
import { MembersCreator } from "@/studio/features/agent-memberships/components/MembersCreator"
import { PendingInvitationsSection } from "@/studio/features/invitations/components/PendingInvitationsSection"
import { revokeInvitation } from "@/studio/features/invitations/invitations.thunks"
import { MembersTable } from "@/studio/features/project-memberships/components/members-table/MembersTable"
import { StudioRoutes } from "@/studio/routes/helpers"
import { agentMembershipsActions } from "../features/agent-memberships/agent-memberships.slice"

export function AgentMembershipsRoute() {
  const agentId = useCurrentId(selectCurrentAgentId)
  const memberships = useAppSelector(selectAgentMemberships)
  const pendingInvitations = useAppSelector(selectAgentPendingInvitations)
  const assignableRoles = useAppSelector(selectAgentAssignableRoles)

  useMount({ actions: agentMembershipsActions, refreshOn: [agentId] })

  return (
    <AsyncRoute data={[memberships, pendingInvitations, assignableRoles]}>
      <WithData />
    </AsyncRoute>
  )
}

/** The agent's members: a table with search, role filter and bulk actions, and the pending invitations. */
function WithData() {
  const memberships = useValue(selectAgentMemberships)
  const assignableRoles = useValue(selectAgentAssignableRoles)
  const agent = useValue(selectCurrentAgentData)
  const me = useValue(selectMe)
  const pendingInvitations = useValue(selectAgentPendingInvitations)
  const dispatch = useAppDispatch()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { abilities } = useAbility()
  const agentRoute = useGetAgentRoute()
  const organizationId = useCurrentId(selectCurrentOrganizationId)

  const handleAddRoles = async (memberUserIds: string[], roleKeys: string[]) => {
    const result = await dispatch(agentMembershipsActions.addRoles({ memberUserIds, roleKeys }))
    if (agentMembershipsActions.addRoles.rejected.match(result)) {
      throw new Error(t("projectMembership:table.addRolesDialog.error"))
    }
  }

  const handleRemoveMembers = async (memberUserIds: string[]) => {
    const result = await dispatch(agentMembershipsActions.removeMany({ memberUserIds }))
    if (agentMembershipsActions.removeMany.rejected.match(result)) {
      throw new Error(t("projectMembership:table.removeDialog.error"))
    }
  }

  // A member's page lists their roles on the workspace, each agent and each campaign.
  const handleOpenMember = (memberUserId: string) =>
    navigate(
      StudioRoutes.projectMembership.build({
        organizationId,
        projectId: agent.projectId,
        memberUserId,
      }),
    )

  const handleRevokeInvitation = (invitationId: string) => {
    void dispatch(revokeInvitation({ invitationId, targetType: "agent", targetId: agent.id }))
  }

  return (
    <>
      <GridHeader
        onBack={() => navigate(agentRoute)}
        title={t("agentMembership:list.title", { agentName: agent.name })}
        description={t("agentMembership:list.description")}
        action={<MembersCreator agentId={agent.id} />}
      />
      <div className="flex flex-col gap-6 bg-white p-6">
        <MembersTable
          scope="agent"
          members={memberships}
          roles={assignableRoles}
          currentUserId={me.id}
          canUpdateRoles={abilities.canUpdateAgentMembers({ agentId: agent.id })}
          canRemoveMembers={abilities.canRemoveAgentMembers({ agentId: agent.id })}
          onAddRoles={handleAddRoles}
          onRemoveMembers={handleRemoveMembers}
          onOpenMember={handleOpenMember}
        />
      </div>
      <PendingInvitationsSection
        invitations={pendingInvitations}
        title={t("agentMembership:pendingInvitations.title")}
        description={t("agentMembership:pendingInvitations.description")}
        onRevoke={handleRevokeInvitation}
      />
    </>
  )
}
