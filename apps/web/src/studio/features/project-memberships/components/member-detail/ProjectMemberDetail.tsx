import { Alert, AlertDescription, AlertTitle } from "@caseai-connect/ui/shad/alert"
import { Badge } from "@caseai-connect/ui/shad/badge"
import { BotIcon, InfoIcon, LayoutGridIcon, MegaphoneIcon, TriangleAlertIcon } from "lucide-react"
import { useState } from "react"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { GridHeader } from "@/common/components/grid/Grid"
import { NeverSignedInBadge } from "@/common/components/NeverSignedInBadge"
import { PROJECT_OWNER_ROLE_KEY } from "../members-table/members-table.models"
import type { MemberDetailMember, MemberResourceRoles, RoleOption } from "./member-detail.models"
import { ResourceRolesSection } from "./ResourceRolesSection"

type PendingRemoval = { resource: MemberResourceRoles; role: RoleOption }

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Try again."
}

const REMOVAL_EFFECT: Record<MemberResourceRoles["kind"], string> = {
  project: "Their permissions on this workspace change right away.",
  agent: "Their permissions on this agent change right away.",
  review_campaign: "Their part in this review campaign changes right away.",
}

/**
 * A member's roles on the workspace, its agents and its review campaigns. Presentational: the
 * caller passes the resources, what the viewer may do, and the handlers that call the API.
 */
export function ProjectMemberDetail({
  member,
  currentUserId,
  workspace,
  agents,
  campaigns,
  isLastOwner,
  onAddRole,
  onRemoveRole,
  onBack,
}: {
  member: MemberDetailMember
  currentUserId: string
  workspace: MemberResourceRoles
  agents: MemberResourceRoles[]
  campaigns: MemberResourceRoles[]
  /** True when the member is the workspace's only `project_owner`. */
  isLastOwner: boolean
  /** Rejects with an `Error` whose message is shown on the page. */
  onAddRole: (resource: MemberResourceRoles, roleKey: string) => Promise<void>
  /** Rejects with an `Error` whose message is shown in the dialog. */
  onRemoveRole: (resource: MemberResourceRoles, roleKey: string) => Promise<void>
  onBack: () => void
}) {
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval | null>(null)
  const [removalError, setRemovalError] = useState<string | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const isSelf = member.userId === currentUserId
  const displayName = member.userName ?? member.userEmail

  const lockedRolesFor = (resource: MemberResourceRoles): Record<string, string> =>
    resource.kind === "project" && isLastOwner
      ? { [PROJECT_OWNER_ROLE_KEY]: "A workspace keeps at least one owner." }
      : {}

  const handleAddRole = async (resource: MemberResourceRoles, role: RoleOption) => {
    setAddError(null)
    try {
      await onAddRole(resource, role.key)
    } catch (error) {
      setAddError(`${role.name} on ${resource.resourceName}: ${errorMessage(error)}`)
    }
  }

  const closeRemoval = () => {
    setPendingRemoval(null)
    setRemovalError(null)
  }

  const confirmRemoval = async () => {
    if (!pendingRemoval) return
    setIsRemoving(true)
    setRemovalError(null)
    try {
      await onRemoveRole(pendingRemoval.resource, pendingRemoval.role.key)
      setPendingRemoval(null)
    } catch (error) {
      setRemovalError(errorMessage(error))
    } finally {
      setIsRemoving(false)
    }
  }

  const sectionProps = {
    readOnly: isSelf,
    lockedRolesFor,
    onAddRole: handleAddRole,
    onRemoveRole: (resource: MemberResourceRoles, role: RoleOption) =>
      setPendingRemoval({ resource, role }),
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <GridHeader
        onBack={onBack}
        title={
          <span className="flex items-center gap-2">
            {displayName}
            {isSelf && <Badge variant="secondary">You</Badge>}
            {!member.userHasSignedIn && <NeverSignedInBadge />}
          </span>
        }
        description={member.userName ? member.userEmail : undefined}
      />

      <div className="flex flex-col gap-6 p-6">
        {isSelf && (
          <Alert>
            <InfoIcon />
            <AlertTitle>This is your own page</AlertTitle>
            <AlertDescription>
              Nobody changes their own roles. Another manager of this workspace can change them.
            </AlertDescription>
          </Alert>
        )}
        {addError && (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>The role was not added</AlertTitle>
            <AlertDescription>{addError}</AlertDescription>
          </Alert>
        )}

        <ResourceRolesSection
          icon={LayoutGridIcon}
          title="Workspace"
          description="What they can do across this workspace."
          emptyLabel="No role on this workspace."
          resources={[workspace]}
          {...sectionProps}
        />
        <ResourceRolesSection
          icon={BotIcon}
          title="Agents"
          description="Their roles on each agent of the workspace."
          emptyLabel="This workspace has no agents."
          resources={agents}
          {...sectionProps}
        />
        <ResourceRolesSection
          icon={MegaphoneIcon}
          title="Review campaigns"
          description="Whether they test the agent or review the conversations, campaign by campaign."
          emptyLabel="This workspace has no review campaigns."
          resources={campaigns}
          {...sectionProps}
        />
      </div>

      <ConfirmDialog
        open={pendingRemoval !== null}
        title={
          pendingRemoval
            ? `Remove ${pendingRemoval.role.name} on ${pendingRemoval.resource.resourceName}?`
            : ""
        }
        description={pendingRemoval ? REMOVAL_EFFECT[pendingRemoval.resource.kind] : undefined}
        confirmLabel="Remove"
        error={removalError}
        isConfirming={isRemoving}
        onCancel={closeRemoval}
        onConfirm={confirmRemoval}
      />
    </div>
  )
}
