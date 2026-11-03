import { Alert, AlertDescription } from "@caseai-connect/ui/shad/alert"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@caseai-connect/ui/shad/collapsible"
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
import { ChevronRightIcon, InfoIcon } from "lucide-react"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import type { RoleOption } from "@/studio/features/project-memberships/components/member-detail/member-detail.models"
import { useRoleLabel } from "@/studio/features/project-memberships/components/members-table/role-label"
import { InviteEmailsField } from "./InviteEmailsField"
import { InviteTargetsField } from "./InviteTargetsField"
import {
  type InviteMembersValues,
  type InviteRoleCatalog,
  type InviteTarget,
  WORKSPACE_ADMIN_ROLE_KEY,
} from "./invite-members.models"

// Phase A: the schema moves to api-contracts with the endpoint.
const inviteMembersSchema = z.object({
  emails: z.array(z.email()).min(1, "Add at least one email."),
  workspaceRoleKey: z.string().min(1),
  agents: z.array(z.object({ targetId: z.string(), roleKey: z.string() })),
  campaigns: z.array(z.object({ targetId: z.string(), roleKey: z.string() })),
})

const WORKSPACE_ROLE_DESCRIPTIONS: Record<string, string> = {
  project_admin: "Manages the workspace, its members and every agent.",
  project_member: "Opens the workspace. Sees only the agents picked below.",
}

/**
 * Invites people to the workspace and, in the same invitation, to some of its agents and review
 * campaigns. Each invitee accepts once and gets every role picked here.
 */
export function InviteMembersDialog({
  open,
  onOpenChange,
  workspaceName,
  roles,
  agents,
  campaigns,
  existingMemberEmails,
  defaultValues,
  onOpenMember,
  onSubmit,
  error,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceName: string
  roles: InviteRoleCatalog
  agents: InviteTarget[]
  campaigns: InviteTarget[]
  /** Emails of people already in the workspace: flagged, and left out of the invitation. */
  existingMemberEmails: string[]
  defaultValues?: Partial<InviteMembersValues>
  onOpenMember: (email: string) => void
  onSubmit: (values: InviteMembersValues) => Promise<void>
  error?: string | null
}) {
  const form = useForm<InviteMembersValues>({
    resolver: zodResolver(inviteMembersSchema),
    defaultValues: {
      emails: [],
      workspaceRoleKey: roles.workspace[roles.workspace.length - 1]?.key ?? "",
      agents: [],
      campaigns: [],
      ...defaultValues,
    },
  })
  const values = useWatch({ control: form.control }) as InviteMembersValues
  const isWorkspaceAdmin = values.workspaceRoleKey === WORKSPACE_ADMIN_ROLE_KEY
  const existing = new Set(existingMemberEmails)
  // Counts the email being typed too, so the button follows the field without waiting for Enter.
  const [draftEmails, setDraftEmails] = useState<string[]>([])
  const inviteeCount = new Set(
    [...values.emails, ...draftEmails].filter((email) => !existing.has(email)),
  ).size

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      form.reset()
      setDraftEmails([])
    }
    onOpenChange(nextOpen)
  }

  const handleValid = async (submitted: InviteMembersValues) => {
    await onSubmit({
      ...submitted,
      emails: submitted.emails.filter((email) => !existing.has(email)),
      // An admin of the workspace is an admin of every agent: no agent role to send.
      agents: submitted.workspaceRoleKey === WORKSPACE_ADMIN_ROLE_KEY ? [] : submitted.agents,
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Invite people to {workspaceName}</DialogTitle>
          <DialogDescription>
            Pick what they get. Each person receives one invitation and accepts it once.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleValid)} className="flex flex-col gap-6">
            <FormField
              control={form.control}
              name="emails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="invite-emails">Emails</FormLabel>
                  <InviteEmailsField
                    emails={field.value}
                    onChange={field.onChange}
                    existingMemberEmails={existingMemberEmails}
                    onOpenMember={onOpenMember}
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
                  <FormLabel>Role on the workspace</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="grid gap-2 sm:grid-cols-2"
                    >
                      {roles.workspace.map((role) => (
                        <WorkspaceRoleOption key={role.key} role={role} />
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="agents"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Agents</FormLabel>
                  {isWorkspaceAdmin ? (
                    <Alert>
                      <InfoIcon />
                      <AlertDescription>
                        Workspace admins are admins of every agent, including the agents created
                        later.
                      </AlertDescription>
                    </Alert>
                  ) : agents.length === 0 ? (
                    <FormDescription>This workspace has no agent yet.</FormDescription>
                  ) : (
                    <>
                      <FormDescription>Optional. Members see only these agents.</FormDescription>
                      <InviteTargetsField
                        idPrefix="invite-agent"
                        targets={agents}
                        roles={roles.agent}
                        value={field.value}
                        onChange={field.onChange}
                        cannotInviteReason="Only this agent's admins can invite to it."
                      />
                    </>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {campaigns.length > 0 && (
              <FormField
                control={form.control}
                name="campaigns"
                render={({ field }) => (
                  <Collapsible defaultOpen={field.value.length > 0}>
                    <CollapsibleTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="group -ml-2 self-start"
                      >
                        <ChevronRightIcon className="transition-transform group-data-[state=open]:rotate-90" />
                        Review campaigns
                        {field.value.length > 0 && ` (${field.value.length})`}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2">
                      <InviteTargetsField
                        idPrefix="invite-campaign"
                        targets={campaigns}
                        roles={roles.campaign}
                        value={field.value}
                        onChange={field.onChange}
                        cannotInviteReason="Only this campaign's managers can invite to it."
                      />
                    </CollapsibleContent>
                  </Collapsible>
                )}
              />
            )}

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            {/* Kept in view while the dialog scrolls, over the dialog's bottom padding. */}
            <DialogFooter className="sticky -bottom-6 -mx-6 -mb-6 rounded-b-lg border-t bg-background px-6 py-4">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {inviteeCount === 0
                  ? "Invite"
                  : inviteeCount === 1
                    ? "Invite 1 person"
                    : `Invite ${inviteeCount} people`}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function WorkspaceRoleOption({ role }: { role: RoleOption }) {
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
          {WORKSPACE_ROLE_DESCRIPTIONS[role.key]}
        </span>
      </span>
    </Label>
  )
}
