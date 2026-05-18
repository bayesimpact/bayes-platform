import type { ProjectMembershipRoleDto } from "@caseai-connect/api-contracts"
import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { CheckIcon, CrownIcon, SendIcon, StarIcon, Trash2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridItem } from "@/common/components/grid/Grid"
import { SUPER_ROLES } from "@/common/features/me/me.models"
import { selectMe } from "@/common/features/me/me.selectors"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { buildSince } from "@/common/utils/build-date"
import type { ProjectMembership } from "@/studio/features/project-memberships/project-memberships.models"
import { removeProjectMembership } from "@/studio/features/project-memberships/project-memberships.thunks"
import { StudioRoutes } from "@/studio/routes/helpers"

export function ProjectMembershipItem({
  membership,
  index,
  organizationId,
}: {
  organizationId: string
  membership: ProjectMembership
  index: number
}) {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const me = useAppSelector(selectMe)
  const handleRemove = () => {
    dispatch(removeProjectMembership({ membershipId: membership.id }))
  }
  const disabled = membership.role === "owner" || membership.userId === me?.value?.id

  const date = buildSince(membership.createdAt)
  const handleClick = () => {
    navigate(
      StudioRoutes.projectMembership.build({
        organizationId,
        projectId: membership.projectId,
        membershipId: membership.id,
      }),
    )
  }

  return (
    <GridItem
      index={index}
      title={membership.userName}
      description={membership.userEmail}
      badge={BadgeWithIcon({ role: membership.role })}
      onClick={handleClick}
      footer={
        <div className="flex items-center gap-4 pt-2 justify-between pb-4 flex-wrap">
          {membership.status === "accepted" ? (
            <Button variant="secondary" size="sm" onClick={() => {}} disabled>
              <CheckIcon className="size-4 text-green-500" />{" "}
              {t("projectMembership:statuses.accepted")}
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => {}} disabled>
              <SendIcon className="size-4" />{" "}
              <span>
                {t("projectMembership:statuses.sent")} {date}
              </span>
            </Button>
          )}
          {!disabled && (
            <Button variant="outline" size="icon-sm" onClick={handleRemove}>
              <Trash2Icon className="size-3.5" />
            </Button>
          )}
        </div>
      }
    />
  )
}

export function BadgeWithIcon({ role }: { role: ProjectMembershipRoleDto }) {
  const iconMap: Record<ProjectMembershipRoleDto, React.ReactNode> = {
    owner: <CrownIcon className="size-3.5 text-primary" />,
    admin: <StarIcon className="size-3.5 text-yellow-500" />,
    member: null,
  }
  const variant = SUPER_ROLES.includes(role) ? "outline" : "secondary"
  const icon = iconMap[role]
  return (
    <Badge className="flex gap-1 capitalize" variant={variant}>
      {icon && <span>{icon}</span>}
      {role}
    </Badge>
  )
}
