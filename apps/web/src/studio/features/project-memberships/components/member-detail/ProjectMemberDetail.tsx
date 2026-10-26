import { Alert, AlertDescription, AlertTitle } from "@caseai-connect/ui/shad/alert"
import { Badge } from "@caseai-connect/ui/shad/badge"
import { BotIcon, InfoIcon, LayoutGridIcon, MegaphoneIcon, TriangleAlertIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { GridHeader } from "@/common/components/grid/Grid"
import { NeverSignedInBadge } from "@/common/components/NeverSignedInBadge"
import { OWNER_ROLE_KEY } from "../members-table/members-table.models"
import { useRoleLabel } from "../members-table/role-label"
import type { MemberDetailMember, MemberResourceRoles, RoleOption } from "./member-detail.models"
import { ResourceRolesSection } from "./ResourceRolesSection"

type PendingRemoval = { resource: MemberResourceRoles; role: RoleOption }

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
  onAddRole,
  onRemoveRole,
  onBack,
}: {
  member: MemberDetailMember
  currentUserId: string
  workspace: MemberResourceRoles
  agents: MemberResourceRoles[]
  campaigns: MemberResourceRoles[]
  /** Rejects with an `Error` whose message is shown on the page. */
  onAddRole: (resource: MemberResourceRoles, roleKey: string) => Promise<void>
  /** Rejects with an `Error` whose message is shown in the dialog. */
  onRemoveRole: (resource: MemberResourceRoles, roleKey: string) => Promise<void>
  onBack: () => void
}) {
  const { t } = useTranslation()
  const roleLabel = useRoleLabel()
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval | null>(null)
  const [removalError, setRemovalError] = useState<string | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const errorMessage = (error: unknown) =>
    error instanceof Error ? error.message : t("projectMembership:table.genericError")
  const isSelf = member.userId === currentUserId
  const displayName = member.userName ?? member.userEmail

  // Owner roles are set when the workspace or the agent is created, never changed here.
  const lockedRolesFor = (resource: MemberResourceRoles): Record<string, string> =>
    resource.kind === "review_campaign"
      ? {}
      : { [OWNER_ROLE_KEY[resource.kind]]: t("projectMembership:memberDetail.ownerLocked") }

  const handleAddRole = async (resource: MemberResourceRoles, role: RoleOption) => {
    setAddError(null)
    try {
      await onAddRole(resource, role.key)
    } catch (error) {
      setAddError(
        t("projectMembership:memberDetail.addErrorDetail", {
          role: roleLabel(role),
          resource: resource.resourceName,
          error: errorMessage(error),
        }),
      )
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
            {isSelf && <Badge variant="secondary">{t("projectMembership:memberDetail.you")}</Badge>}
            {!member.userHasSignedIn && <NeverSignedInBadge />}
          </span>
        }
        description={member.userName ? member.userEmail : undefined}
      />

      <div className="flex flex-col gap-6 p-6">
        {isSelf && (
          <Alert>
            <InfoIcon />
            <AlertTitle>{t("projectMembership:memberDetail.selfTitle")}</AlertTitle>
            <AlertDescription>
              {t("projectMembership:memberDetail.selfDescription")}
            </AlertDescription>
          </Alert>
        )}
        {addError && (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>{t("projectMembership:memberDetail.addErrorTitle")}</AlertTitle>
            <AlertDescription>{addError}</AlertDescription>
          </Alert>
        )}

        <ResourceRolesSection
          icon={LayoutGridIcon}
          title={t("projectMembership:memberDetail.workspace.title")}
          description={t("projectMembership:memberDetail.workspace.description")}
          emptyLabel={t("projectMembership:memberDetail.workspace.empty")}
          resources={[workspace]}
          {...sectionProps}
        />
        <ResourceRolesSection
          icon={BotIcon}
          title={t("projectMembership:memberDetail.agents.title")}
          description={t("projectMembership:memberDetail.agents.description")}
          emptyLabel={t("projectMembership:memberDetail.agents.empty")}
          resources={agents}
          {...sectionProps}
        />
        <ResourceRolesSection
          icon={MegaphoneIcon}
          title={t("projectMembership:memberDetail.campaigns.title")}
          description={t("projectMembership:memberDetail.campaigns.description")}
          emptyLabel={t("projectMembership:memberDetail.campaigns.empty")}
          resources={campaigns}
          {...sectionProps}
        />
      </div>

      <ConfirmDialog
        open={pendingRemoval !== null}
        title={
          pendingRemoval
            ? t("projectMembership:memberDetail.removeDialog.title", {
                role: roleLabel(pendingRemoval.role),
                resource: pendingRemoval.resource.resourceName,
              })
            : ""
        }
        description={
          pendingRemoval
            ? t(
                `projectMembership:memberDetail.removeDialog.effect.${pendingRemoval.resource.kind}`,
              )
            : undefined
        }
        confirmLabel={t("actions:remove")}
        error={removalError}
        isConfirming={isRemoving}
        onCancel={closeRemoval}
        onConfirm={confirmRemoval}
      />
    </div>
  )
}
