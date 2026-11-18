import {
  PROJECT_REVIEW_CAMPAIGN_DELETE_PERMISSION,
  PROJECT_REVIEW_CAMPAIGN_UPDATE_PERMISSION,
  type ReviewCampaignDetailOutputDto,
  type ReviewCampaignParamsDto,
} from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useNavigate } from "@tanstack/react-router"
import { EllipsisIcon, RocketIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { Button } from "@/components/ui/button"
import { ButtonGroup, ButtonGroupSeparator } from "@/components/ui/button-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { type EvaluationAgent, hasProjectPermission } from "@/features/agents"
import { useDeleteCampaign, useUpdateCampaign } from "../api/mutations"

export type CampaignStatusActionsProps = {
  agent: EvaluationAgent
  campaign: ReviewCampaignDetailOutputDto
  campaignParams: ReviewCampaignParamsDto
  /** Whether the setup has changes that are not saved: activating would leave them out. */
  hasUnsavedChanges: boolean
  /** Whether a draft's Activate shows here: the setup's last step holds it instead. */
  showsActivate?: boolean
}

type Confirmation = "activate" | "close" | "delete"

/**
 * What moves a campaign on: activate a draft, or delete it from the menu beside, and close an
 * active campaign. Each one asks for a confirmation, since none can be taken back.
 */
export function CampaignStatusActions({
  agent,
  campaign,
  campaignParams,
  hasUnsavedChanges,
  showsActivate = true,
}: CampaignStatusActionsProps) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState<Confirmation | null>(null)
  const updateCampaign = useUpdateCampaign(campaignParams)
  const deleteCampaign = useDeleteCampaign(campaignParams)
  const canUpdate = hasProjectPermission(agent.project, PROJECT_REVIEW_CAMPAIGN_UPDATE_PERMISSION)
  const canActivate = canUpdate && showsActivate
  const canDelete = hasProjectPermission(agent.project, PROJECT_REVIEW_CAMPAIGN_DELETE_PERMISSION)
  const name = campaign.name
  const close = () => setConfirming(null)

  const handleActivate = () =>
    updateCampaign.mutate(
      { status: "active" },
      {
        onSuccess: () => {
          close()
          toast.success(t`The campaign is active. You can invite its participants.`)
          void navigate({ to: ".", search: { tab: "participants" } })
        },
        onError: () => toast.error(t`The campaign could not be activated. Try again.`),
      },
    )
  const handleClose = () =>
    updateCampaign.mutate(
      { status: "closed" },
      {
        onSuccess: () => {
          close()
          toast.success(t`The campaign is closed.`)
          void navigate({ to: ".", search: { tab: "summary" } })
        },
        onError: () => toast.error(t`The campaign could not be closed. Try again.`),
      },
    )
  const handleDelete = () =>
    deleteCampaign.mutate(undefined, {
      onSuccess: () => {
        close()
        toast.success(t`The campaign was deleted.`)
        void navigate({
          to: "/o/$organizationId/p/$projectId/a/$agentId/review-campaigns",
          params: { ...campaignParams, agentId: agent.id },
        })
      },
      onError: () => toast.error(t`The campaign could not be deleted. Try again.`),
    })

  return (
    <>
      {campaign.status === "draft" && (canActivate || canDelete) ? (
        <ButtonGroup>
          {canActivate ? (
            <Button
              disabled={hasUnsavedChanges}
              title={hasUnsavedChanges ? t`Save your changes first.` : undefined}
              onClick={() => setConfirming("activate")}
            >
              <RocketIcon data-icon="inline-start" aria-hidden />
              <Trans comment="Opens a review campaign to its testers and reviewers">Activate</Trans>
            </Button>
          ) : null}
          {canActivate && canDelete ? <ButtonGroupSeparator /> : null}
          {canDelete ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant={canActivate ? "default" : "outline"}
                    size="icon"
                    aria-label={t`More actions`}
                  />
                }
              >
                <EllipsisIcon aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem variant="destructive" onClick={() => setConfirming("delete")}>
                  <Trash2Icon aria-hidden />
                  <Trans>Delete</Trans>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </ButtonGroup>
      ) : null}
      {campaign.status === "active" && canUpdate ? (
        <Button variant="outline" onClick={() => setConfirming("close")}>
          <Trans comment="Ends a review campaign">Close the campaign</Trans>
        </Button>
      ) : null}
      <ConfirmDialog
        isOpen={confirming === "activate"}
        onOpenChange={close}
        title={<Trans>Activate “{name}”?</Trans>}
        description={
          <Trans>
            Once active, the campaign's questions can no longer change, and its testers and
            reviewers can see it. You can still invite more people.
          </Trans>
        }
        confirmLabel={
          <Trans comment="Opens a review campaign to its testers and reviewers">Activate</Trans>
        }
        isPending={updateCampaign.isPending}
        onConfirm={handleActivate}
      />
      <ConfirmDialog
        isOpen={confirming === "close"}
        onOpenChange={close}
        title={<Trans>Close “{name}”?</Trans>}
        description={
          <Trans>
            Closing ends the campaign for good: testers can no longer start sessions or give
            feedback, and reviewers can no longer submit reviews.
          </Trans>
        }
        confirmLabel={<Trans comment="Ends a review campaign">Close the campaign</Trans>}
        isPending={updateCampaign.isPending}
        onConfirm={handleClose}
      />
      <ConfirmDialog
        isOpen={confirming === "delete"}
        onOpenChange={close}
        title={<Trans>Delete “{name}”?</Trans>}
        description={
          <Trans>
            The draft and its questions are deleted for good. An active or closed campaign cannot be
            deleted.
          </Trans>
        }
        confirmLabel={<Trans>Delete</Trans>}
        isDestructive
        isPending={deleteCampaign.isPending}
        onConfirm={handleDelete}
      />
    </>
  )
}
