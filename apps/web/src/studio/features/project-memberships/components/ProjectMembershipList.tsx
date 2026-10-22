import { useTranslation } from "react-i18next"
import { useNavigate, useOutlet } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import { selectMe } from "@/common/features/me/me.selectors"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useAbility } from "@/common/hooks/use-ability"
import { useGetProjectRoute } from "@/common/hooks/use-get-path"
import { useValue } from "@/common/hooks/use-value"
import { useAppDispatch } from "@/common/store/hooks"
import { PendingInvitationsSection } from "@/studio/features/invitations/components/PendingInvitationsSection"
import { revokeInvitation } from "@/studio/features/invitations/invitations.thunks"
import { MembersCreator } from "@/studio/features/project-memberships/components/MembersCreator"
import { ProjectMembersTable } from "@/studio/features/project-memberships/components/members-table/ProjectMembersTable"
import {
  selectAssignableProjectRoles,
  selectProjectMemberships,
  selectProjectPendingInvitations,
} from "@/studio/features/project-memberships/project-memberships.selectors"
import {
  addProjectMemberRoles,
  removeProjectMembers,
} from "@/studio/features/project-memberships/project-memberships.thunks"
import { StudioRoutes } from "@/studio/routes/helpers"

/** The workspace members: a table with search, role filter and bulk actions, and the pending invitations. */
export function ProjectMembershipList() {
  const outlet = useOutlet()
  const dispatch = useAppDispatch()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { abilities } = useAbility()

  const project = useValue(selectCurrentProjectData)
  const me = useValue(selectMe)
  const memberships = useValue(selectProjectMemberships)
  const assignableRoles = useValue(selectAssignableProjectRoles)
  const pendingInvitations = useValue(selectProjectPendingInvitations)

  const projectRoute = useGetProjectRoute()

  const handleAddRoles = async (memberUserIds: string[], roleKeys: string[]) => {
    const result = await dispatch(addProjectMemberRoles({ memberUserIds, roleKeys }))
    if (addProjectMemberRoles.rejected.match(result)) {
      throw new Error(t("projectMembership:table.addRolesDialog.error"))
    }
  }

  const handleRemoveMembers = async (memberUserIds: string[]) => {
    const result = await dispatch(removeProjectMembers({ memberUserIds }))
    if (removeProjectMembers.rejected.match(result)) {
      throw new Error(t("projectMembership:table.removeDialog.error"))
    }
  }

  const handleOpenMember = (memberUserId: string) =>
    navigate(
      StudioRoutes.projectMembership.build({
        organizationId: project.organizationId,
        projectId: project.id,
        memberUserId,
      }),
    )

  const handleRevokeInvitation = (invitationId: string) => {
    void dispatch(revokeInvitation({ invitationId, targetType: "project", targetId: project.id }))
  }

  if (outlet) return outlet
  return (
    <>
      <GridHeader
        onBack={() => navigate(projectRoute)}
        title={t("projectMembership:list.title", { projectName: project.name })}
        description={t("projectMembership:list.description")}
        action={<MembersCreator projectId={project.id} />}
      />
      <div className="flex flex-col gap-6 bg-white p-6">
        <ProjectMembersTable
          members={memberships}
          roles={assignableRoles}
          currentUserId={me.id}
          canUpdateRoles={abilities.canUpdateProjectMemberRole({ projectId: project.id })}
          canRemoveMembers={abilities.canRemoveProjectMembers({ projectId: project.id })}
          onAddRoles={handleAddRoles}
          onRemoveMembers={handleRemoveMembers}
          onOpenMember={handleOpenMember}
        />
      </div>
      <PendingInvitationsSection
        invitations={pendingInvitations}
        title={t("projectMembership:pendingInvitations.title")}
        description={t("projectMembership:pendingInvitations.description")}
        onRevoke={handleRevokeInvitation}
      />
    </>
  )
}
