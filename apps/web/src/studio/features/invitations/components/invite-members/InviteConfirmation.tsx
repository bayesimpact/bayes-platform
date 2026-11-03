import { Alert, AlertDescription } from "@caseai-connect/ui/shad/alert"
import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { DialogFooter, DialogHeader, DialogTitle } from "@caseai-connect/ui/shad/dialog"
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from "@caseai-connect/ui/shad/item"
import { CircleAlertIcon } from "lucide-react"
import type { RoleOption } from "@/studio/features/project-memberships/components/member-detail/member-detail.models"
import { useRoleLabel } from "@/studio/features/project-memberships/components/members-table/role-label"
import {
  type InviteAgent,
  type InviteeAccess,
  type InviteMembersValues,
  STICKY_FOOTER_CLASS,
  WORKSPACE_ADMIN_ROLE_KEY,
} from "./invite-members.models"

/**
 * The second screen of the invite dialog: what each person gets, and what some already have, to
 * confirm or go back.
 */
export function InviteConfirmation({
  values,
  workspaceName,
  workspaceRoles,
  agents,
  existingAccess,
  error,
  isConfirming,
  onBack,
  onConfirm,
}: {
  values: InviteMembersValues
  workspaceName: string
  workspaceRoles: RoleOption[]
  agents: InviteAgent[]
  existingAccess: Record<string, InviteeAccess>
  error?: string | null
  isConfirming: boolean
  onBack: () => void
  onConfirm: () => void
}) {
  const roleLabel = useRoleLabel()
  const labelOf = (roleKey: string) => {
    const role = workspaceRoles.find((candidate) => candidate.key === roleKey)
    return role ? roleLabel(role) : roleKey
  }
  const isAdmin = values.workspaceRoleKey === WORKSPACE_ADMIN_ROLE_KEY
  const pickedAgents = agents.filter((agent) => values.agentIds.includes(agent.id))
  const agentsLine = isAdmin
    ? "Every agent"
    : pickedAgents.length === 0
      ? "No agent"
      : pickedAgents.map((agent) => agent.name).join(", ")

  return (
    <>
      <DialogHeader>
        <DialogTitle>Confirm the invitation to {workspaceName}</DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md bg-muted/50 px-3 py-2 text-sm">
          <dt className="text-muted-foreground">Role</dt>
          <dd className="font-medium">{labelOf(values.workspaceRoleKey)}</dd>
          <dt className="text-muted-foreground">Agents</dt>
          <dd>{agentsLine}</dd>
        </dl>

        <ItemGroup className="gap-1">
          {values.emails.map((email) => {
            const access = existingAccess[email]
            return (
              <Item key={email} variant="outline" size="sm" className="py-2">
                <ItemContent>
                  <ItemTitle className="break-all font-normal">{email}</ItemTitle>
                </ItemContent>
                {access && (
                  <ItemActions>
                    <ExistingAccessNote
                      access={access}
                      values={values}
                      pickedAgents={pickedAgents}
                      roleLabel={labelOf(access.workspaceRoleKey)}
                    />
                  </ItemActions>
                )}
              </Item>
            )
          })}
        </ItemGroup>

        {error && (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      <DialogFooter className={STICKY_FOOTER_CLASS}>
        <Button type="button" variant="outline" onClick={onBack} disabled={isConfirming}>
          Back
        </Button>
        <Button type="button" onClick={onConfirm} disabled={isConfirming}>
          Confirm
        </Button>
      </DialogFooter>
    </>
  )
}

/**
 * What a person already in the workspace holds among what is picked: their role, and the picked
 * agents they already reach. When the invitation adds nothing, it says so.
 */
function ExistingAccessNote({
  access,
  values,
  pickedAgents,
  roleLabel,
}: {
  access: InviteeAccess
  values: InviteMembersValues
  pickedAgents: InviteAgent[]
  roleLabel: string
}) {
  const isAlreadyAdmin = access.workspaceRoleKey === WORKSPACE_ADMIN_ROLE_KEY
  const heldAgents = pickedAgents.filter((agent) => access.agentIds.includes(agent.id))
  const addsNothing =
    isAlreadyAdmin ||
    (access.workspaceRoleKey === values.workspaceRoleKey &&
      heldAgents.length === pickedAgents.length)

  if (addsNothing) return <Badge variant="secondary">Already has this access</Badge>
  return (
    <span className="text-right text-xs text-muted-foreground">
      Already {roleLabel}
      {heldAgents.length > 0 && ` · ${heldAgents.map((agent) => agent.name).join(", ")}`}
    </span>
  )
}
