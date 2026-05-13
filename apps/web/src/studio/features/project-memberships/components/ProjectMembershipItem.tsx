import type { ProjectMembershipRoleDto } from "@caseai-connect/api-contracts"
import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { CrownIcon, StarIcon, Trash2Icon } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { GridItem } from "@/common/components/grid/Grid"
import { selectMe } from "@/common/features/me/me.selectors"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import type { ProjectMembership } from "@/studio/features/project-memberships/project-memberships.models"
import { removeProjectMembership } from "@/studio/features/project-memberships/project-memberships.thunks"
import { buildProjectMembershipPath } from "@/studio/routes/helpers"

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
  const me = useAppSelector(selectMe)
  const handleRemove = () => {
    dispatch(removeProjectMembership({ membershipId: membership.id }))
  }
  const disabled = membership.role === "owner" || membership.userId === me?.value?.id

  const handleClick = () => {
    navigate(
      buildProjectMembershipPath({
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
      topAction={
        !disabled ? (
          <Button variant="outline" size="icon-sm" onClick={handleRemove}>
            <Trash2Icon className="size-3.5" />
          </Button>
        ) : undefined
      }
    />
  )
}

export function BadgeWithIcon({ role }: { role: ProjectMembershipRoleDto }) {
  const superRoles = ["owner", "admin"]
  const iconMap: Record<ProjectMembershipRoleDto, React.ReactNode> = {
    owner: <CrownIcon className="size-3.5 text-primary" />,
    admin: <StarIcon className="size-3.5 text-yellow-500" />,
    member: null,
  }
  const variant = superRoles.includes(role) ? "outline" : "secondary"
  const icon = iconMap[role]
  return (
    <Badge className="flex gap-1 capitalize" variant={variant}>
      {icon && <span>{icon}</span>}
      {role}
    </Badge>
  )
}
