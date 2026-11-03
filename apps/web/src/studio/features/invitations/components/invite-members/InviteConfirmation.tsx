import { Alert, AlertDescription } from "@caseai-connect/ui/shad/alert"
import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@caseai-connect/ui/shad/dialog"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@caseai-connect/ui/shad/item"
import { CircleAlertIcon } from "lucide-react"
import type { ReactNode } from "react"
import type { RoleOption } from "@/studio/features/project-memberships/components/member-detail/member-detail.models"
import { useRoleLabel } from "@/studio/features/project-memberships/components/members-table/role-label"
import {
  type InviteAgent,
  type InviteMembersValues,
  STICKY_FOOTER_CLASS,
  WORKSPACE_ADMIN_ROLE_KEY,
  WORKSPACE_ROLE_DESCRIPTIONS,
} from "./invite-members.models"

/** The second screen of the invite dialog: what is about to be sent, to confirm or go back. */
export function InviteConfirmation({
  values,
  workspaceName,
  workspaceRoles,
  agents,
  error,
  isConfirming,
  onBack,
  onConfirm,
}: {
  values: InviteMembersValues
  workspaceName: string
  workspaceRoles: RoleOption[]
  agents: InviteAgent[]
  error?: string | null
  isConfirming: boolean
  onBack: () => void
  onConfirm: () => void
}) {
  const roleLabel = useRoleLabel()
  const workspaceRole = workspaceRoles.find((role) => role.key === values.workspaceRoleKey)
  const pickedAgents = agents.filter((agent) => values.agentIds.includes(agent.id))
  const count = values.emails.length

  return (
    <>
      <DialogHeader>
        <DialogTitle>Confirm the invitation</DialogTitle>
        <DialogDescription>
          {count === 1 ? "This person" : `These ${count} people`} will get access to {workspaceName}{" "}
          once they accept.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-6">
        <Section title={count === 1 ? "1 person" : `${count} people`}>
          <div className="flex flex-wrap gap-1.5">
            {values.emails.map((email) => (
              <Badge key={email} variant="outline">
                {email}
              </Badge>
            ))}
          </div>
        </Section>

        <Section title="Role on the workspace">
          <p className="text-sm">
            <span className="font-medium">
              {workspaceRole ? roleLabel(workspaceRole) : values.workspaceRoleKey}
            </span>
            <span className="text-muted-foreground">
              {" · "}
              {WORKSPACE_ROLE_DESCRIPTIONS[values.workspaceRoleKey]}
            </span>
          </p>
        </Section>

        <Section title="Agents">
          {values.workspaceRoleKey === WORKSPACE_ADMIN_ROLE_KEY ? (
            <p className="text-sm text-muted-foreground">
              Every agent of the workspace, including the agents created later.
            </p>
          ) : pickedAgents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No agent.</p>
          ) : (
            <ItemGroup className="gap-1">
              {pickedAgents.map((agent) => (
                <Item key={agent.id} variant="muted" size="sm" className="py-2">
                  <ItemContent className="flex-row items-baseline gap-2">
                    <ItemTitle>{agent.name}</ItemTitle>
                    {agent.detail && (
                      <ItemDescription className="text-xs">{agent.detail}</ItemDescription>
                    )}
                  </ItemContent>
                </Item>
              ))}
            </ItemGroup>
          )}
        </Section>

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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
  )
}
