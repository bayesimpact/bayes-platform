import { Alert, AlertDescription } from "@caseai-connect/ui/shad/alert"
import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { DialogFooter, DialogHeader, DialogTitle } from "@caseai-connect/ui/shad/dialog"
import { CircleAlertIcon, TriangleAlertIcon } from "lucide-react"
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
  const newEmails = values.emails.filter((email) => !existingAccess[email])
  const knownPeople = values.emails.flatMap((email) => {
    const access = existingAccess[email]
    return access ? [{ email, access }] : []
  })
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

        {/* Newcomers as chips. People already in the workspace go apart: the invitation leaves
            them as they are. */}
        {newEmails.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {newEmails.map((email) => (
              <Badge key={email} variant="outline">
                {email}
              </Badge>
            ))}
          </div>
        )}

        {knownPeople.length > 0 && (
          <section className="flex gap-3 text-sm">
            {/* The theme has no warning color: the amber of the design system's warning variants. */}
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex flex-col gap-1">
                <h3 className="font-medium">
                  {knownPeople.length === 1
                    ? "1 person is already in the workspace"
                    : `${knownPeople.length} people are already in the workspace`}
                </h3>
                <p className="text-muted-foreground">
                  The invitation leaves {knownPeople.length === 1 ? "them" : "these people"} as they
                  are. Change their access from their member page.
                </p>
              </div>
              <ul className="flex flex-col gap-1">
                {knownPeople.map(({ email, access }) => (
                  <li key={email} className="flex flex-wrap justify-between gap-x-3">
                    <span className="break-all">{email}</span>
                    <span className="text-muted-foreground">
                      {describeAccess({
                        access,
                        agents,
                        roleLabel: labelOf(access.workspaceRoleKey),
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

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

/** What a person already in the workspace holds there: their role, and their agents. */
function describeAccess({
  access,
  agents,
  roleLabel,
}: {
  access: InviteeAccess
  agents: InviteAgent[]
  roleLabel: string
}): string {
  if (access.workspaceRoleKey === WORKSPACE_ADMIN_ROLE_KEY) return roleLabel
  const heldAgents = agents.filter((agent) => access.agentIds.includes(agent.id))
  return [roleLabel, ...heldAgents.map((agent) => agent.name)].join(" · ")
}
