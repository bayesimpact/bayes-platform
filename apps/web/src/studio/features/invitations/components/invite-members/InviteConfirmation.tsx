import { Alert, AlertDescription } from "@caseai-connect/ui/shad/alert"
import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { DialogFooter, DialogHeader, DialogTitle } from "@caseai-connect/ui/shad/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@caseai-connect/ui/shad/tooltip"
import { CircleAlertIcon, InfoIcon } from "lucide-react"
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
  const hasKnownPeople = values.emails.some((email) => existingAccess[email])
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

        {/* Every invitee as a chip, to keep a long list short. A person already in the workspace
            gets a marked chip, with what they hold on hover. */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            {values.emails.map((email) => {
              const access = existingAccess[email]
              if (!access) {
                return (
                  <Badge key={email} variant="outline">
                    {email}
                  </Badge>
                )
              }
              return (
                <Tooltip key={email}>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" tabIndex={0} className="cursor-default">
                      <InfoIcon />
                      {email}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    {describeExistingAccess({
                      access,
                      values,
                      pickedAgents,
                      roleLabel: labelOf(access.workspaceRoleKey),
                    })}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
          {hasKnownPeople && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <InfoIcon className="size-3.5" />
              Already in the workspace. Hover to see what they hold.
            </p>
          )}
        </div>

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
function describeExistingAccess({
  access,
  values,
  pickedAgents,
  roleLabel,
}: {
  access: InviteeAccess
  values: InviteMembersValues
  pickedAgents: InviteAgent[]
  roleLabel: string
}): string {
  const isAlreadyAdmin = access.workspaceRoleKey === WORKSPACE_ADMIN_ROLE_KEY
  const heldAgents = pickedAgents.filter((agent) => access.agentIds.includes(agent.id))
  const addsNothing =
    isAlreadyAdmin ||
    (access.workspaceRoleKey === values.workspaceRoleKey &&
      heldAgents.length === pickedAgents.length)

  if (addsNothing) return `Already ${roleLabel}, with this access. Nothing changes for them.`
  if (heldAgents.length === 0) return `Already ${roleLabel}.`
  return `Already ${roleLabel}, on ${heldAgents.map((agent) => agent.name).join(", ")}.`
}
