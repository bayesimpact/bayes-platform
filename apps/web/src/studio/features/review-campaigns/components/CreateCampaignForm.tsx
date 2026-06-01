import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useAppDispatch } from "@/common/store/hooks"
import { createReviewCampaign } from "../review-campaigns.thunks"
import { CampaignForm, type CampaignFormAgentOption, type CampaignFormValues } from "./CampaignForm"
import { getDefaultCampaignValues } from "./campaign-form.shared"

type Props = {
  agents: CampaignFormAgentOption[]
  onSuccess?: () => void
}

export function CreateCampaignForm({ agents, onSuccess }: Props) {
  const dispatch = useAppDispatch()
  const { t, i18n } = useTranslation()

  // Memoize so question UUIDs stay stable across re-renders within a single
  // create session. Recomputed only if language changes.
  const defaultValues = useMemo(
    () => getDefaultCampaignValues({ t, language: i18n.language }),
    [t, i18n.language],
  )

  const handleSubmit = async (values: CampaignFormValues) => {
    await dispatch(
      createReviewCampaign({
        fields: {
          agentId: values.agentId,
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

  return (
    <CampaignForm
      mode="create"
      status="draft"
      agents={agents}
      memberships={[]}
      defaultValues={defaultValues}
      onSubmit={handleSubmit}
    />
  )
}
