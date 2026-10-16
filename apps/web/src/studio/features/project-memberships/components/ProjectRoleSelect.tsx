import type { EditableProjectMembershipRoleDto } from "@caseai-connect/api-contracts"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@caseai-connect/ui/shad/select"
import { StarIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { selectMe } from "@/common/features/me/me.selectors"
import { useAbility } from "@/common/hooks/use-ability"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { BadgeWithIcon } from "@/studio/features/project-memberships/components/ProjectMembershipItem"
import type { ProjectMembership } from "@/studio/features/project-memberships/project-memberships.models"
import { updateProjectMembershipRole } from "@/studio/features/project-memberships/project-memberships.thunks"

const EDITABLE_ROLES: EditableProjectMembershipRoleDto[] = ["admin", "member"]

/**
 * Lets an admin or owner switch another member between admin and member, after a confirmation. The
 * owner's role and the viewer's own role stay a read-only badge, as the API refuses to change them.
 */
export function ProjectRoleSelect({ membership }: { membership: ProjectMembership }) {
  const dispatch = useAppDispatch()
  const { t } = useTranslation()
  const me = useAppSelector(selectMe)
  const { abilities } = useAbility()
  const [isSaving, setIsSaving] = useState(false)
  const [pendingRole, setPendingRole] = useState<EditableProjectMembershipRoleDto | null>(null)

  const role = membership.role
  const isEditable =
    role !== "owner" &&
    membership.userId !== me?.value?.id &&
    abilities.canUpdateProjectMemberRole({ projectId: membership.projectId })

  if (!isEditable) return <BadgeWithIcon role={role} />

  const handleRoleSelect = (nextRole: EditableProjectMembershipRoleDto) => {
    if (nextRole !== role) setPendingRole(nextRole)
  }

  const handleConfirm = async () => {
    if (!pendingRole) return
    setPendingRole(null)
    setIsSaving(true)
    try {
      await dispatch(
        updateProjectMembershipRole({ membershipId: membership.id, role: pendingRole }),
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <Select
        value={role}
        onValueChange={(value) => handleRoleSelect(value as EditableProjectMembershipRoleDto)}
        disabled={isSaving}
      >
        <SelectTrigger size="sm" aria-label={t("projectMembership:profile.roleSelect")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {EDITABLE_ROLES.map((editableRole) => (
            <SelectItem key={editableRole} value={editableRole}>
              {editableRole === "admin" && <StarIcon className="size-3.5 text-yellow-500" />}
              {t(`projectMembership:roles.${editableRole}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ConfirmDialog
        open={pendingRole !== null}
        title={t("projectMembership:roleChange.dialog.title", {
          name: membership.userName ?? membership.userEmail,
          role: pendingRole ? t(`projectMembership:roles.${pendingRole}`) : "",
        })}
        description={t("projectMembership:roleChange.dialog.description")}
        confirmLabel={t("actions:confirm")}
        confirmVariant="default"
        onConfirm={handleConfirm}
        onCancel={() => setPendingRole(null)}
      />
    </>
  )
}
