import { Button } from "@caseai-connect/ui/shad/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@caseai-connect/ui/shad/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@caseai-connect/ui/shad/form"
import { Label } from "@caseai-connect/ui/shad/label"
import { RadioGroup, RadioGroupItem } from "@caseai-connect/ui/shad/radio-group"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMemo, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import type { RoleOption } from "@/studio/features/project-memberships/components/member-detail/member-detail.models"
import { useRoleLabel } from "@/studio/features/project-memberships/components/members-table/role-label"
import { InviteAgentsField } from "./InviteAgentsField"
import { InviteConfirmation } from "./InviteConfirmation"
import { InviteEmailsField } from "./InviteEmailsField"
import {
  existingInviteeOutcome,
  type InviteAgent,
  type InviteeAccess,
  type InviteMembersValues,
  STICKY_FOOTER_CLASS,
  WORKSPACE_ADMIN_ROLE_KEY,
} from "./invite-members.models"

/**
 * Invites people to the workspace and, in the same invitation, to some of its agents. The manager
 * picks, then checks a summary and confirms. Each invitee accepts once and gets every access
 * picked here.
 */
export function InviteMembersDialog({
  open,
  onOpenChange,
  workspaceName,
  workspaceRoles,
  agents,
  existingAccess = {},
  defaultValues,
  onSubmit,
  error,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceName: string
  /** The workspace roles an invitation can give: owner is set at creation, never offered. */
  workspaceRoles: RoleOption[]
  agents: InviteAgent[]
  /** What people already in the workspace hold, by email, for the confirmation screen. */
  existingAccess?: Record<string, InviteeAccess>
  defaultValues?: Partial<InviteMembersValues>
  onSubmit: (values: InviteMembersValues) => Promise<void>
  error?: string | null
}) {
  const { t } = useTranslation()
  // The form picks role keys: the thunk maps them to the contract's `createProjectInvitationsSchema`.
  const inviteMembersSchema = useMemo(
    () =>
      z.object({
        emails: z.array(z.email()).min(1, t("invitations:inviteDialog.emailsRequired")),
        workspaceRoleKey: z.string().min(1),
        agentIds: z.array(z.string()),
      }),
    [t],
  )
  const form = useForm<InviteMembersValues>({
    resolver: zodResolver(inviteMembersSchema),
    defaultValues: {
      emails: [],
      workspaceRoleKey: workspaceRoles[workspaceRoles.length - 1]?.key ?? "",
      agentIds: [],
      ...defaultValues,
    },
  })
  const values = useWatch({ control: form.control }) as InviteMembersValues
  const isWorkspaceAdmin = values.workspaceRoleKey === WORKSPACE_ADMIN_ROLE_KEY
  // Counts the email being typed too, so the button follows the field without waiting for Enter.
  const [draftEmails, setDraftEmails] = useState<string[]>([])
  const inviteeCount = new Set([...values.emails, ...draftEmails]).size
  // The values checked on the confirmation screen; null while the manager is still picking.
  const [pending, setPending] = useState<InviteMembersValues | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      form.reset()
      setDraftEmails([])
      setPending(null)
    }
    onOpenChange(nextOpen)
  }

  const handleReview = (submitted: InviteMembersValues) =>
    setPending({
      ...submitted,
      // An admin of the workspace is an admin of every agent: no agent to send.
      agentIds: submitted.workspaceRoleKey === WORKSPACE_ADMIN_ROLE_KEY ? [] : submitted.agentIds,
    })

  const handleConfirm = async () => {
    if (!pending) return
    setIsConfirming(true)
    try {
      // Newcomers are invited; people already in the workspace get what they miss right away.
      // Those for whom nothing changes are left out.
      await onSubmit({
        ...pending,
        emails: pending.emails.filter((email) => {
          const access = existingAccess[email]
          return !access || existingInviteeOutcome(access, pending).kind === "addAgents"
        }),
      })
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        {pending ? (
          <InviteConfirmation
            values={pending}
            workspaceName={workspaceName}
            workspaceRoles={workspaceRoles}
            agents={agents}
            existingAccess={existingAccess}
            error={error}
            isConfirming={isConfirming}
            onBack={() => setPending(null)}
            onConfirm={handleConfirm}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("invitations:inviteDialog.title", { workspaceName })}</DialogTitle>
              <DialogDescription>{t("invitations:inviteDialog.description")}</DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleReview)} className="flex flex-col gap-6">
                <FormField
                  control={form.control}
                  name="emails"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="invite-emails">
                        {t("invitations:inviteDialog.emailsLabel")}
                      </FormLabel>
                      <InviteEmailsField
                        emails={field.value}
                        onChange={field.onChange}
                        onDraftChange={setDraftEmails}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="workspaceRoleKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("invitations:inviteDialog.workspaceRoleLabel")}</FormLabel>
                      <FormControl>
                        <RadioGroup
                          value={field.value}
                          onValueChange={field.onChange}
                          className="grid gap-2 sm:grid-cols-2"
                        >
                          {workspaceRoles.map((role) => (
                            <WorkspaceRoleOption key={role.key} role={role} />
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!isWorkspaceAdmin && (
                  <FormField
                    control={form.control}
                    name="agentIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("invitations:inviteDialog.agentsLabel")}</FormLabel>
                        {agents.length === 0 ? (
                          <FormDescription>
                            {t("invitations:inviteDialog.noAgents")}
                          </FormDescription>
                        ) : (
                          <InviteAgentsField
                            agents={agents}
                            value={field.value}
                            onChange={field.onChange}
                          />
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <DialogFooter className={STICKY_FOOTER_CLASS}>
                  <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                    {t("actions:cancel")}
                  </Button>
                  <Button type="submit">
                    {inviteeCount === 0
                      ? t("actions:invite")
                      : t("invitations:inviteDialog.inviteCount", { count: inviteeCount })}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function WorkspaceRoleOption({ role }: { role: RoleOption }) {
  const { t } = useTranslation()
  const roleLabel = useRoleLabel()
  const id = `invite-workspace-role-${role.key}`
  return (
    <Label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-md border p-3 font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent/40"
    >
      <RadioGroupItem value={role.key} id={id} className="mt-0.5" />
      <span className="flex flex-col gap-1">
        <span className="font-medium">{roleLabel(role)}</span>
        <span className="text-xs text-muted-foreground">
          {t(`invitations:inviteDialog.roleDescriptions.${role.key}`, { defaultValue: "" })}
        </span>
      </span>
    </Label>
  )
}
