import { Button } from "@caseai-connect/ui/shad/button"
import { PlusCircleIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { selectAgentsData } from "@/common/features/agents/agents.selectors"
import { useAbility } from "@/common/hooks/use-ability"
import { useValue } from "@/common/hooks/use-value"
import { useAppDispatch } from "@/common/store/hooks"
import { InviteMembersDialog } from "@/studio/features/invitations/components/invite-members/InviteMembersDialog"
import {
  type InviteMembersValues,
  WORKSPACE_ADMIN_ROLE_KEY,
} from "@/studio/features/invitations/components/invite-members/invite-members.models"
import { createInvitations } from "@/studio/features/invitations/invitations.thunks"
import {
  selectAssignableRoles,
  selectInviteeAccess,
} from "@/studio/features/project-memberships/project-memberships.selectors"

/** The workspace roles an invitation gives: owner is set when the workspace is created. */
const INVITABLE_WORKSPACE_ROLE_KEYS = [WORKSPACE_ADMIN_ROLE_KEY, "project_member"]

/** Opens the invite dialog of the workspace, and sends what the manager confirms. */
export function InviteMembersButton({
  projectId,
  workspaceName,
}: {
  projectId: string
  workspaceName: string
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const { abilities } = useAbility()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const workspaceRoles = useValue(selectAssignableRoles).project.filter((role) =>
    INVITABLE_WORKSPACE_ROLE_KEYS.includes(role.key),
  )
  // Only the agents the manager may invite people to: the API refuses the others.
  const agents = useValue(selectAgentsData)
    .filter((agent) => abilities.canInviteAgentMembers({ agentId: agent.id }))
    .map((agent) => ({
      id: agent.id,
      name: agent.name,
      detail: t(`projectMembership:memberDetail.details.${agent.type}`, { defaultValue: "" }),
    }))
  const existingAccess = useValue(selectInviteeAccess)

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    setError(null)
  }

  const handleSubmit = async (values: InviteMembersValues) => {
    setError(null)
    const result = await dispatch(
      createInvitations({
        targetType: "project",
        targetId: projectId,
        emails: values.emails,
        role: values.workspaceRoleKey === WORKSPACE_ADMIN_ROLE_KEY ? "admin" : "member",
        agentIds: values.agentIds,
      }),
    )
    if (createInvitations.rejected.match(result)) {
      setError(t("projectMembership:notifications.inviteError"))
      return
    }
    setOpen(false)
  }

  return (
    <>
      <Button size="lg" className="text-base" onClick={() => handleOpenChange(true)}>
        {t("actions:invite")}
        <PlusCircleIcon className="ml-2 size-5" />
      </Button>
      <InviteMembersDialog
        open={open}
        onOpenChange={handleOpenChange}
        workspaceName={workspaceName}
        workspaceRoles={workspaceRoles}
        agents={agents}
        existingAccess={existingAccess}
        onSubmit={handleSubmit}
        error={error}
      />
    </>
  )
}
