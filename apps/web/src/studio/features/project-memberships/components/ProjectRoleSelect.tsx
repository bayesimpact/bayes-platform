import type { EditableProjectMembershipRoleDto } from "@caseai-connect/api-contracts"
import { Badge } from "@caseai-connect/ui/shad/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@caseai-connect/ui/shad/select"
import { CrownIcon, StarIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { SUPER_ROLES } from "@/common/features/me/me.models"
import { selectMe } from "@/common/features/me/me.selectors"
import {
  type LegacyMembershipRole,
  toLegacyRole,
} from "@/common/features/memberships/membership-roles"
import { useAbility } from "@/common/hooks/use-ability"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import type { ProjectMembership } from "@/studio/features/project-memberships/project-memberships.models"
import { updateProjectMembershipRole } from "@/studio/features/project-memberships/project-memberships.thunks"

const EDITABLE_ROLES: EditableProjectMembershipRoleDto[] = ["admin", "member"]

/**
 * Lets an admin or owner switch another member between admin and member, after a confirmation. The
 * owner's role and the viewer's own role stay a read-only badge, as the API refuses to change them.
 * It shows the highest of the member's roles until the member page shows them all (#1077).
 */
export function ProjectRoleSelect({ membership }: { membership: ProjectMembership }) {
  const dispatch = useAppDispatch()
  const { t } = useTranslation()
  const me = useAppSelector(selectMe)
  const { abilities } = useAbility()
  const [isSaving, setIsSaving] = useState(false)
  const [pendingRole, setPendingRole] = useState<EditableProjectMembershipRoleDto | null>(null)

  const role = toLegacyRole(membership.roles) ?? "member"
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
        updateProjectMembershipRole({ memberUserId: membership.userId, role: pendingRole }),
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

export function BadgeWithIcon({ role }: { role: LegacyMembershipRole }) {
  const { t } = useTranslation()
  const iconMap: Record<LegacyMembershipRole, React.ReactNode> = {
    owner: <CrownIcon className="size-3.5 text-primary" />,
    admin: <StarIcon className="size-3.5 text-yellow-500" />,
    member: null,
  }
  const variant = SUPER_ROLES.includes(role) ? "outline" : "secondary"
  const icon = iconMap[role]
  return (
    <Badge className="flex gap-1" variant={variant}>
      {icon && <span>{icon}</span>}
      {t(`projectMembership:roles.${role}`)}
    </Badge>
  )
}
