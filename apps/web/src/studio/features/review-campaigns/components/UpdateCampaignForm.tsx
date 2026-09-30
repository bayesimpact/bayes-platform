import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAppDispatch } from "@/common/store/hooks"
import { createMemberGrants } from "@/studio/features/member-grants/member-grants.thunks"
import { StudioRoutes } from "@/studio/routes/helpers"
import type { ReviewCampaignDetail } from "../review-campaigns.models"
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
  const navigate = useNavigate()
  const [dialog, setDialog] = useState<DialogKind>(null)

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

  const handleAddParticipants = (role: "tester" | "reviewer", emails: string[]) => {
    void dispatch(
      createMemberGrants({
        targetType: "review_campaign",
        targetId: campaign.id,
        emails,
        role,
      }),
    )
  }

  const handleRevoke = (membershipId: string) => {
    dispatch(revokeReviewCampaignMembership({ reviewCampaignId: campaign.id, membershipId }))
  }

  return (
    <>
      <CampaignForm
        mode="edit"
        status={campaign.status}
        agents={agents}
        memberships={campaign.memberships}
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
        onAddParticipants={handleAddParticipants}
        onRevokeMember={handleRevoke}
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
