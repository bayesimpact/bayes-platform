import { Button } from "@caseai-connect/ui/shad/button"
import { Trash2Icon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { GridCard } from "@/common/components/grid/Grid"
import { selectMe } from "@/common/features/me/me.selectors"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import type { AgentMembership } from "@/studio/features/agent-memberships/agent-memberships.models"
import { agentMembershipsActions } from "../agent-memberships.slice"

export function AgentMembershipItem({ membership }: { membership: AgentMembership }) {
  const dispatch = useAppDispatch()
  const me = useAppSelector(selectMe)
  const { t } = useTranslation()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handleConfirmRemove = () => {
    dispatch(agentMembershipsActions.remove({ membershipId: membership.id }))
    setConfirmOpen(false)
  }

  const disabled = membership.role === "owner" || membership.userId === me?.value?.id

  return (
    <>
      <GridCard>
        {!disabled && (
          <GridCard.TopAction>
            <Button variant="outline" size="icon-sm" onClick={() => setConfirmOpen(true)}>
              <Trash2Icon className="size-3.5" />
            </Button>
          </GridCard.TopAction>
        )}
        <GridCard.Badge>{membership.role}</GridCard.Badge>
        <GridCard.Body>
          <GridCard.Title>{membership.userName}</GridCard.Title>
          <GridCard.Description>{membership.userEmail}</GridCard.Description>
        </GridCard.Body>
      </GridCard>
      <ConfirmDialog
        open={confirmOpen}
        title={t("agentMembership:remove.dialog.title", { name: membership.userName })}
        description={t("agentMembership:remove.dialog.description")}
        confirmLabel={t("agentMembership:remove.dialog.confirm")}
        onConfirm={handleConfirmRemove}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
