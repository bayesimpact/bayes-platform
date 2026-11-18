import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"
import { SETUP_STEPS, type SetupStep } from "./schemas"

/** The name of each step of a campaign's setup, in the stepper. */
export const SETUP_STEP_LABELS = {
  campaign: msg({ message: "Campaign", comment: "The setup step with a campaign's name" }),
  session: msg({
    message: "After each session",
    comment: "The setup step with the questions a tester answers after each session",
  }),
  final: msg({
    message: "Final survey",
    comment: "The setup step with the questions a tester answers once, at the end",
  }),
  reviewers: msg({
    message: "Session review",
    comment: "The setup step with the questions a reviewer answers",
  }),
  activate: msg({ message: "Activate", comment: "The setup step that opens a campaign" }),
  invite: msg({ message: "Invite", comment: "The setup step that invites testers and reviewers" }),
} as const satisfies Record<SetupStep, MessageDescriptor>

/** The fields of the setup's form each step checks before the next one. */
export const SETUP_STEP_FIELDS = {
  campaign: ["name", "description"],
  session: ["testerPerSessionQuestions"],
  final: ["testerEndOfPhaseQuestions"],
  reviewers: ["reviewerQuestions"],
  activate: [],
  invite: [],
} as const satisfies Record<SetupStep, readonly string[]>

/** The step after this one, or none after the last. */
export function nextSetupStep(step: SetupStep): SetupStep | undefined {
  return SETUP_STEPS[SETUP_STEPS.indexOf(step) + 1]
}

/** The step before this one, or none before the first. */
export function previousSetupStep(step: SetupStep): SetupStep | undefined {
  const index = SETUP_STEPS.indexOf(step)
  return index > 0 ? SETUP_STEPS[index - 1] : undefined
}
