import type { AgentVersionOutputDto } from "@caseai-connect/eval-contracts"
import type { I18n } from "@lingui/core"
import { msg } from "@lingui/core/macro"
import type { CampaignFormValues, QuestionFormValues } from "./schemas"

const question = (
  values: Partial<QuestionFormValues> & { prompt: string },
): QuestionFormValues => ({
  id: crypto.randomUUID(),
  type: "rating",
  required: true,
  isFactual: false,
  optionsText: "",
  ...values,
})

/**
 * The setup a new campaign starts from, in the person's language: the version of the agent in
 * production, a name with the agent and the day, and a first question in each list, which the
 * person changes.
 */
export function defaultCampaignValues(
  i18n: I18n,
  agentName: string,
  versions: AgentVersionOutputDto[],
): CampaignFormValues {
  const today = new Intl.DateTimeFormat(i18n.locale, { dateStyle: "medium" }).format(new Date())
  return {
    agentSettingsId: versions.find((version) => version.isProduction)?.id ?? "",
    name: i18n._(msg`Campaign for ${agentName}, ${today}`),
    description: i18n._(msg`Evaluate the agent's answers and share your feedback.`),
    testerPerSessionQuestions: [
      question({ prompt: i18n._(msg`Was the agent's answer clear?`) }),
      question({
        prompt: i18n._(msg`Did the agent address your question?`),
        type: "single-choice",
        isFactual: true,
        optionsText: [
          i18n._(
            msg({ message: "Yes", comment: "An answer to: Did the agent address your question?" }),
          ),
          i18n._(
            msg({
              message: "Partially",
              comment: "An answer to: Did the agent address your question?",
            }),
          ),
          i18n._(
            msg({ message: "No", comment: "An answer to: Did the agent address your question?" }),
          ),
        ].join(", "),
      }),
    ],
    testerEndOfPhaseQuestions: [
      question({ prompt: i18n._(msg`How satisfied are you with this agent overall?`) }),
    ],
    reviewerQuestions: [
      question({ prompt: i18n._(msg`Were the agent's answers factually correct?`) }),
    ],
  }
}
