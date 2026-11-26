import type { AgentParamsDto, ReviewCampaignParamsDto } from "@bayes-platform/eval-contracts"
import { zodResolver } from "@hookform/resolvers/zod"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { HeaderActions } from "@/components/shared/HeaderActions"
import { SidePanelToggle } from "@/components/shared/SidePanelToggle"
import { SplitPage } from "@/components/shared/SplitPage"
import type { EvaluationAgent } from "@/features/agents"
import { agentVersionsQueryOptions } from "@/features/agents"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useUpdateCampaign } from "../api/mutations"
import { campaignQueryOptions } from "../api/queries"
import { campaignConfigInputOf, campaignFormValuesOf } from "../campaign-form"
import { campaignFormSchema, type QuestionListName, type SetupStep } from "../schemas"
import { nextSetupStep, previousSetupStep, SETUP_STEP_FIELDS } from "../setup-steps"
import { ActivateStep } from "./ActivateStep"
import { CampaignGeneralFields } from "./CampaignGeneralFields"
import { CampaignPageFrame } from "./CampaignPageFrame"
import { FeedbackPreview } from "./FeedbackPreview"
import { ParticipantsPanel } from "./ParticipantsPanel"
import { QuestionListEditor } from "./QuestionListEditor"
import { SetupStepFooter } from "./SetupStepFooter"
import { SetupStepper } from "./SetupStepper"
import { UnsavedChangesGuard } from "./UnsavedChangesGuard"

export type CampaignSetupWizardProps = {
  agent: EvaluationAgent
  agentParams: AgentParamsDto
  campaignParams: ReviewCampaignParamsDto
  step: SetupStep
  /** Whether the URL opens or closes the preview panel, or none for what the window has room for. */
  preview: boolean | undefined
}

/** Tailwind's `xl`, from which a step and the preview panel both have room. */
const ROOMY_QUERY = "(min-width: 80rem)"

/** The list of questions each step of questions edits. */
const STEP_LISTS: Partial<Record<SetupStep, QuestionListName>> = {
  session: "testerPerSessionQuestions",
  final: "testerEndOfPhaseQuestions",
  reviewers: "reviewerQuestions",
}

const QUESTION_STEPS: SetupStep[] = ["session", "final", "reviewers"]

/**
 * A draft's setup, one step at a time: its name, its three lists of questions, its activation,
 * then its invitations. Leaving a step, by Next, Back or the stepper, checks it and saves what
 * changed; leaving the page with changes not saved asks first. The URL names the step, so a reload
 * stays on it.
 */
export function CampaignSetupWizard({
  agent,
  agentParams,
  campaignParams,
  step,
  preview,
}: CampaignSetupWizardProps) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const { data: campaign } = useSuspenseQuery(campaignQueryOptions(campaignParams))
  const { data: versions } = useSuspenseQuery(agentVersionsQueryOptions(agentParams))
  const updateCampaign = useUpdateCampaign(campaignParams)
  const form = useForm({
    resolver: zodResolver(campaignFormSchema),
    // The form follows the campaign as the API returns it, after each save; a read of the
    // campaign in the background keeps what the person is writing.
    values: campaignFormValuesOf(campaign, versions),
    resetOptions: { keepDirtyValues: true },
  })
  const isDraft = campaign.status === "draft"
  const hasRoom = useMediaQuery(ROOMY_QUERY)
  const isQuestionStep = QUESTION_STEPS.includes(step)
  const isPreviewOpen = isQuestionStep && (preview ?? hasRoom)

  const goTo = (target: SetupStep) => void navigate({ to: ".", search: { step: target } })
  // What the form holds against the campaign as saved: a read of the campaign in the background
  // keeps what the person wrote, but not the form's own sense of what changed.
  const hasUnsavedChanges = () =>
    JSON.stringify(campaignConfigInputOf(form.getValues())) !==
    JSON.stringify(campaignConfigInputOf(campaignFormValuesOf(campaign, versions)))
  /** Saves what changed, if anything, then does what follows. */
  const saveThen = (then: () => void) => {
    if (!hasUnsavedChanges()) return then()
    updateCampaign.mutate(campaignConfigInputOf(form.getValues()), {
      onSuccess: then,
      onError: () => toast.error(t`The campaign could not be saved. Try again.`),
    })
  }
  // Every way to another step, Back and the stepper too, checks this step and saves it first.
  const moveTo = async (target: SetupStep | undefined) => {
    if (!target) return
    const isValid = await form.trigger([...SETUP_STEP_FIELDS[step]])
    if (isValid) saveThen(() => goTo(target))
  }
  const previous = previousSetupStep(step)
  // What is not saved yet goes in before the questions freeze.
  const handleActivate = () =>
    saveThen(() =>
      updateCampaign.mutate(
        { status: "active" },
        {
          onSuccess: () => {
            toast.success(t`The campaign is active. You can invite its participants.`)
            goTo("invite")
          },
          onError: () => toast.error(t`The campaign could not be activated. Try again.`),
        },
      ),
    )

  return (
    <SplitPage
      panel={
        isPreviewOpen ? (
          <FeedbackPreview
            control={form.control}
            onClose={() => void navigate({ to: ".", search: { step, preview: false } })}
            takesFocus={preview === true}
            currentList={isQuestionStep ? STEP_LISTS[step] : undefined}
          />
        ) : null
      }
    >
      {isQuestionStep ? (
        <HeaderActions>
          <SidePanelToggle
            isOpen={isPreviewOpen}
            onToggle={() => void navigate({ to: ".", search: { step, preview: !isPreviewOpen } })}
          >
            <Trans comment="The button that shows the forms testers and reviewers will fill">
              Preview
            </Trans>
          </SidePanelToggle>
        </HeaderActions>
      ) : null}
      <UnsavedChangesGuard hasUnsavedChanges={hasUnsavedChanges} />
      <CampaignPageFrame
        agent={agent}
        agentParams={agentParams}
        campaignParams={campaignParams}
        hasUnsavedChanges={form.formState.isDirty}
        steps={
          <SetupStepper
            currentStep={step}
            // A draft's steps reopen until its activation; an active campaign's setup is done.
            canOpen={(target) => isDraft && target !== "invite"}
            onOpen={(target) => void moveTo(target)}
          />
        }
      >
        {step === "campaign" ? (
          <CampaignGeneralFields
            form={form}
            agentName={agent.name}
            agentParams={agentParams}
            isLocked={false}
          />
        ) : null}
        {step === "session" ? (
          <QuestionListEditor
            control={form.control}
            list="testerPerSessionQuestions"
            title={<Trans>After each session</Trans>}
            description={<Trans>Asked each time a tester ends a session with the agent.</Trans>}
            hasFactual
            disabled={false}
          />
        ) : null}
        {step === "final" ? (
          <QuestionListEditor
            control={form.control}
            list="testerEndOfPhaseQuestions"
            title={<Trans>Final survey</Trans>}
            description={<Trans>Asked once, when a tester finishes taking part.</Trans>}
            disabled={false}
          />
        ) : null}
        {step === "reviewers" ? (
          <QuestionListEditor
            control={form.control}
            list="reviewerQuestions"
            title={<Trans>Session review</Trans>}
            description={<Trans>Asked to a reviewer for each session they review.</Trans>}
            disabled={false}
          />
        ) : null}
        {step === "activate" ? (
          <ActivateStep
            campaign={campaign}
            isPending={updateCampaign.isPending}
            onActivate={handleActivate}
          />
        ) : null}
        {step === "invite" ? (
          <ParticipantsPanel agent={agent} campaign={campaign} campaignParams={campaignParams} />
        ) : null}
        {step === "invite" ? (
          <SetupStepFooter
            onNext={() => void navigate({ to: ".", search: { tab: "participants" } })}
            nextLabel={<Trans comment="Ends a campaign's setup">Done</Trans>}
          />
        ) : (
          <SetupStepFooter
            onBack={previous ? () => void moveTo(previous) : undefined}
            onNext={step === "activate" ? undefined : () => void moveTo(nextSetupStep(step))}
            isPending={updateCampaign.isPending}
          />
        )}
      </CampaignPageFrame>
    </SplitPage>
  )
}
