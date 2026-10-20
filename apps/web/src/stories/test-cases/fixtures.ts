import { fn } from "storybook/test"
import { organizationFactory } from "@/common/features/organizations/organization.factory"
import { projectFactory } from "@/common/features/projects/projects.factory"
import { evaluationConversationDatasetFactory } from "@/eval/features/evaluation-conversation-datasets/evaluation-conversation-datasets.factory"
import {
  testCaseInputDraftFactory,
  testCaseSourceFactory,
} from "@/studio/features/test-cases/test-cases.factory"
import type { TestCase, TestCaseInputMode } from "@/studio/features/test-cases/test-cases.models"

const mockOrganization = organizationFactory.build({ id: "org-1" })

const mockProject = projectFactory
  .transient({ organization: mockOrganization })
  .build({ id: "proj-1", name: "Demo project" })

export const mockDatasets = [
  evaluationConversationDatasetFactory
    .transient({ project: mockProject })
    .build({ id: "dataset-1", name: "Billing questions", recordCount: 24 }),
  evaluationConversationDatasetFactory
    .transient({ project: mockProject })
    .build({ id: "dataset-2", name: "Product questions", recordCount: 12 }),
  evaluationConversationDatasetFactory
    .transient({ project: mockProject })
    .build({ id: "dataset-3", name: "Support escalations", recordCount: 1 }),
]

// A short billing conversation. The saved answer depends on the plan and date the first turn
// gave, and the first turn holds the personal data Anonymize strips.
const firstUserMessage =
  "Hi, I'm Jordan Lee (jordan.lee@example.com). I bought the annual Pro plan on March 3."
const firstAnswer = "Thanks, Jordan. What can I do for you about your Pro plan?"
const lastUserMessage = "Can I switch to the monthly plan and get the difference back?"
const savedAnswer =
  "Yes. You can switch to monthly billing from **Settings › Billing**. Since you are three weeks into your annual plan, the unused part (about €98) is refunded to your card within 5 business days."

export const mockPraise =
  "It says where to switch, how much comes back and when, without asking for anything the customer already gave."

export const mockCritique =
  "Wrong refund rule: a plan switch turns the unused part into store credit, it never goes back to the card."

const standaloneQuestion =
  "A customer, Jordan Lee (jordan.lee@example.com), bought the annual Pro plan on March 3 and is three weeks in. Can they switch to the monthly plan and get the unused part back?"

const correctedAnswer =
  "Yes. You can switch to monthly billing from **Settings › Billing**. The unused part of your annual plan (about €98) becomes store credit, applied to your next monthly invoices. It is not refunded to your card."

/** The last answer of the conversation, one earlier turn behind it. */
export const mockTestCaseSource = testCaseSourceFactory.build({
  agentMessageId: "message-4",
  answer: savedAnswer,
})

/** The first answer: no earlier turn, so both input modes give the same input. */
export const mockFirstTurnTestCaseSource = testCaseSourceFactory.build({
  agentMessageId: "message-2",
  answer: firstAnswer,
})

const LLM_DELAY_MS = 900

const waitForLlm = () => new Promise((resolve) => setTimeout(resolve, LLM_DELAY_MS))

// Stands in for the LLM: replaces the personal data this conversation holds.
const anonymize = (text: string) =>
  text
    .replaceAll("Jordan Lee", "[name]")
    .replaceAll("Jordan", "[name]")
    .replaceAll("jordan.lee@example.com", "[email]")
    .replaceAll("March 3", "[date]")

// What the API drafts for each answer of the conversation, in each input mode.
const draftInputFor = (agentMessageId: string, inputMode: TestCaseInputMode | null) => {
  if (agentMessageId === mockFirstTurnTestCaseSource.agentMessageId) {
    return testCaseInputDraftFactory.build({
      inputMode: "lastMessage",
      input: firstUserMessage,
      lastUserMessage: firstUserMessage,
      earlierTurnCount: 0,
    })
  }
  return testCaseInputDraftFactory.build({
    inputMode: inputMode ?? "conversation",
    input: inputMode === "lastMessage" ? lastUserMessage : standaloneQuestion,
    lastUserMessage,
    earlierTurnCount: 1,
  })
}

/** The dialog's LLM calls and save, answering after a short wait so the pending states show. */
export function buildMockTestCaseCallbacks({
  agentMessageId = mockTestCaseSource.agentMessageId,
  failDrafts = false,
}: {
  agentMessageId?: string
  failDrafts?: boolean
} = {}) {
  return {
    onDraftInput: fn(async (inputMode: TestCaseInputMode | null) => {
      await waitForLlm()
      if (failDrafts) throw new Error("The LLM did not answer")
      return draftInputFor(agentMessageId, inputMode)
    }),
    onDraftExpectedOutput: fn(async (_comment: string) => {
      await waitForLlm()
      if (failDrafts) throw new Error("The LLM did not answer")
      return correctedAnswer
    }),
    onAnonymize: fn(async (text: string) => {
      await waitForLlm()
      return anonymize(text)
    }),
    onSave: fn(async (_testCase: TestCase, _datasetName: string) => {
      await waitForLlm()
    }),
  }
}
