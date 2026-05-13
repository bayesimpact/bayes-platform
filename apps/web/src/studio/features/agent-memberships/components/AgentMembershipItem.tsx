import { Button } from "@caseai-connect/ui/shad/button"
import { Trash2Icon } from "lucide-react"
import { GridItem } from "@/common/components/grid/Grid"
import { selectMe } from "@/common/features/me/me.selectors"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import type { AgentMembership } from "@/studio/features/agent-memberships/agent-memberships.models"
import { agentMembershipsActions } from "../agent-memberships.slice"

export function AgentMembershipItem({
  membership,
  index,
}: {
  membership: AgentMembership
  index: number
}) {
  const dispatch = useAppDispatch()
  const me = useAppSelector(selectMe)
  const handleRemove = () => {
    dispatch(agentMembershipsActions.remove({ membershipId: membership.id }))
  }

  const disabled = membership.role === "owner" || membership.userId === me?.value?.id

  return (
    <GridItem
      index={index}
      title={membership.userName}
      description={membership.userEmail}
      badge={membership.role}
      action={undefined}
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
