import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ADS } from "@/common/store/async-data-status"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import {
  createInvitationsForTarget,
  listInvitationsForTarget,
  revokeInvitation,
} from "@/studio/features/invitations/invitations.thunks"
import { StudioRoutes } from "@/studio/routes/helpers"
import type { ReviewCampaignDetail } from "../review-campaigns.models"
import { selectReviewCampaignPendingInvitations } from "../review-campaigns.selectors"
import {
  deleteReviewCampaign,
  revokeReviewCampaignMembership,
  updateReviewCampaign,
} from "../review-campaigns.thunks"
import { ActivateCampaignDialog } from "./ActivateCampaignDialog"
import { CampaignForm, type CampaignFormAgentOption, type CampaignFormValues } from "./CampaignForm"
import { CloseCampaignDialog } from "./CloseCampaignDialog"
import { DeleteCampaignDialog } from "./DeleteCampaignDialog"

type Props = {
  campaign: ReviewCampaignDetail
  agents: CampaignFormAgentOption[]
  onSuccess?: () => void
  onDeleted?: () => void
}

type DialogKind = "activate" | "close" | "delete" | null

export function UpdateCampaignForm({ campaign, agents, onSuccess, onDeleted }: Props) {
  const dispatch = useAppDispatch()
  const pendingInvitationsData = useAppSelector(selectReviewCampaignPendingInvitations)
  const navigate = useNavigate()
  const [dialog, setDialog] = useState<DialogKind>(null)
  const pendingInvitations = ADS.isFulfilled(pendingInvitationsData)
    ? pendingInvitationsData.value
    : []

  // FIXME: should be moved in middleware when .mount
  useEffect(() => {
    dispatch(listInvitationsForTarget({ targetType: "review_campaign", targetId: campaign.id }))
  }, [campaign.id, dispatch])

  const handleOpenReport = () => {
    navigate(
      StudioRoutes.reviewCampaignReport.build({
        organizationId: campaign.organizationId,
        projectId: campaign.projectId,
        reviewCampaignId: campaign.id,
      }),
    )
  }

  const handleSubmit = async (values: CampaignFormValues) => {
    await dispatch(
      updateReviewCampaign({
        reviewCampaignId: campaign.id,
        fields: {
          name: values.name,
          description: values.description,
          testerPerSessionQuestions: values.testerPerSessionQuestions,
          testerEndOfPhaseQuestions: values.testerEndOfPhaseQuestions,
          reviewerQuestions: values.reviewerQuestions,
        },
      }),
    ).unwrap()
    onSuccess?.()
  }

  const handleActivate = async () => {
    await dispatch(
      updateReviewCampaign({
        reviewCampaignId: campaign.id,
        fields: { status: "active" },
      }),
    ).unwrap()
    setDialog(null)
    onSuccess?.()
  }

  const handleClose = async () => {
    await dispatch(
      updateReviewCampaign({
        reviewCampaignId: campaign.id,
        fields: { status: "closed" },
      }),
    ).unwrap()
    setDialog(null)
    onSuccess?.()
  }

  const handleDelete = async () => {
    await dispatch(deleteReviewCampaign({ reviewCampaignId: campaign.id })).unwrap()
    setDialog(null)
    onDeleted?.()
  }

  const handleInvite = (role: "tester" | "reviewer", emails: string[]) => {
    void dispatch(
      createInvitationsForTarget({
        targetType: "review_campaign",
        targetId: campaign.id,
        emails,
        role,
        refreshTarget: { targetType: "review_campaign", targetId: campaign.id },
      }),
    )
  }

  const handleRevoke = (membershipId: string) => {
    dispatch(revokeReviewCampaignMembership({ reviewCampaignId: campaign.id, membershipId }))
  }

  const handleRevokeInvitation = (invitationId: string) => {
    void dispatch(
      revokeInvitation({
        invitationId,
        refreshTarget: { targetType: "review_campaign", targetId: campaign.id },
      }),
    )
  }

  return (
    <>
      <CampaignForm
        mode="edit"
        status={campaign.status}
        agents={agents}
        memberships={campaign.memberships}
        pendingInvitations={pendingInvitations}
        aggregates={campaign.aggregates}
        defaultValues={{
          name: campaign.name,
          description: campaign.description,
          agentId: campaign.agentId,
          testerPerSessionQuestions: campaign.testerPerSessionQuestions,
          testerEndOfPhaseQuestions: campaign.testerEndOfPhaseQuestions,
          reviewerQuestions: campaign.reviewerQuestions,
        }}
        onSubmit={handleSubmit}
        onActivate={() => setDialog("activate")}
        onClose={() => setDialog("close")}
        onDelete={() => setDialog("delete")}
        onInviteMember={handleInvite}
        onRevokeMember={handleRevoke}
        onRevokeInvitation={handleRevokeInvitation}
        onOpenReport={handleOpenReport}
      />

      <ActivateCampaignDialog
        open={dialog === "activate"}
        campaignName={campaign.name}
        onConfirm={handleActivate}
        onCancel={() => setDialog(null)}
      />
      <CloseCampaignDialog
        open={dialog === "close"}
        campaignName={campaign.name}
        onConfirm={handleClose}
        onCancel={() => setDialog(null)}
      />
      <DeleteCampaignDialog
        open={dialog === "delete"}
        campaignName={campaign.name}
        onConfirm={handleDelete}
        onCancel={() => setDialog(null)}
      />
    </>
  )
}
