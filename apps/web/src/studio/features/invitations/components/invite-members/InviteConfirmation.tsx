import { Alert, AlertDescription } from "@caseai-connect/ui/shad/alert"
import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { DialogFooter, DialogHeader, DialogTitle } from "@caseai-connect/ui/shad/dialog"
import { CircleAlertIcon, TriangleAlertIcon, UserCheckIcon } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import type { RoleOption } from "@/studio/features/project-memberships/components/member-detail/member-detail.models"
import { useRoleLabel } from "@/studio/features/project-memberships/components/members-table/role-label"
import {
  existingInviteeOutcome,
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
  const { t, i18n } = useTranslation()
  const joinNames = (names: string[]) =>
    new Intl.ListFormat(i18n.language, { type: "conjunction" }).format(names)
  const roleLabel = useRoleLabel()
  const labelOf = (roleKey: string) => {
    const role = workspaceRoles.find((candidate) => candidate.key === roleKey)
    return role ? roleLabel(role) : roleKey
  }
  const newEmails = values.emails.filter((email) => !existingAccess[email])
  const knownPeople = values.emails.flatMap((email) => {
    const access = existingAccess[email]
    return access ? [{ email, access, outcome: existingInviteeOutcome(access, values) }] : []
  })
  const nameOf = (agentId: string) => agents.find((agent) => agent.id === agentId)?.name ?? agentId
  const directPeople = knownPeople.flatMap(({ email, outcome }) =>
    outcome.kind === "addAgents"
      ? [
          {
            email,
            line: t("invitations:confirmation.addedTo", {
              agents: joinNames(outcome.agentIds.map(nameOf)),
            }),
          },
        ]
      : [],
  )
  const unchangedPeople = knownPeople.flatMap(({ email, access, outcome }) => {
    if (outcome.kind !== "unchanged") return []
    const current = describeAccess(access)
    return [
      {
        email,
        line:
          outcome.reason === "noPromotion"
            ? t("invitations:confirmation.promoteHint", { access: current })
            : current,
      },
    ]
  })
  /**
   * What a person already in the workspace holds there, as a short sentence: "Member, on Helpful
   * Assistant and Scheduling Bot". An admin reaches every agent, so their role says it all.
   */
  function describeAccess(access: InviteeAccess): string {
    const role = labelOf(access.workspaceRoleKey)
    if (access.workspaceRoleKey === WORKSPACE_ADMIN_ROLE_KEY) return role
    const agentNames = agents
      .filter((agent) => access.agentIds.includes(agent.id))
      .map((agent) => agent.name)
    return agentNames.length === 0
      ? t("invitations:confirmation.accessOnNoAgent", { role })
      : t("invitations:confirmation.accessOnAgents", { role, agents: joinNames(agentNames) })
  }
  const isAdmin = values.workspaceRoleKey === WORKSPACE_ADMIN_ROLE_KEY
  const pickedAgents = agents.filter((agent) => values.agentIds.includes(agent.id))
  const agentsLine = isAdmin
    ? t("invitations:confirmation.everyAgent")
    : pickedAgents.length === 0
      ? t("invitations:confirmation.noAgent")
      : pickedAgents.map((agent) => agent.name).join(", ")

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("invitations:confirmation.title", { workspaceName })}</DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        {/* Newcomers first, then what their invitation gives them. People already in the
            workspace go apart, in two groups: those who get access right away, and those for
            whom nothing changes. */}
        {newEmails.length > 0 && (
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-1.5">
              {newEmails.map((email) => (
                <Badge key={email} variant="outline">
                  {email}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {t("invitations:confirmation.invitedGet", { count: newEmails.length })}
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md bg-muted/50 px-3 py-2 text-sm">
              <dt className="text-muted-foreground">
                {t("invitations:confirmation.workspaceRole")}
              </dt>
              <dd className="font-medium">{labelOf(values.workspaceRoleKey)}</dd>
              <dt className="text-muted-foreground">{t("invitations:confirmation.agents")}</dt>
              <dd>{agentsLine}</dd>
            </dl>
          </section>
        )}

        {directPeople.length > 0 && (
          <PeopleBlock
            icon={<UserCheckIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
            title={t("invitations:confirmation.directTitle", { count: directPeople.length })}
            hint={t("invitations:confirmation.directHint")}
            people={directPeople}
          />
        )}

        {unchangedPeople.length > 0 && (
          <PeopleBlock
            // The theme has no warning color: the amber of the design system's warning variants.
            icon={
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            }
            title={t("invitations:confirmation.unchangedTitle", { count: unchangedPeople.length })}
            hint={t("invitations:confirmation.unchangedHint")}
            people={unchangedPeople}
          />
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
          {t("actions:back")}
        </Button>
        <Button type="button" onClick={onConfirm} disabled={isConfirming}>
          {t("actions:confirm")}
        </Button>
      </DialogFooter>
    </>
  )
}

/** A group of people already in the workspace: an icon, a title, a hint, two lines per person. */
function PeopleBlock({
  icon,
  title,
  hint,
  people,
}: {
  icon: ReactNode
  title: string
  hint: string
  people: { email: string; line: string }[]
}) {
  return (
    <section className="flex gap-3 rounded-xl border p-4 text-sm">
      {icon}
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="font-medium">{title}</h3>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <ul className="flex flex-col gap-2">
          {people.map(({ email, line }) => (
            <li key={email} className="flex flex-col">
              <span className="break-all">{email}</span>
              <span className="text-xs text-muted-foreground">{line}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
