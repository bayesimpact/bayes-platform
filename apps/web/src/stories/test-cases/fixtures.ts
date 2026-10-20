import { fn } from "storybook/test"
import { agentFactory } from "@/common/features/agents/agent.factory"
import { agentSessionMessageFactory } from "@/common/features/agents/agent-sessions/agent-session.factory"
import { organizationFactory } from "@/common/features/organizations/organization.factory"
import { projectFactory } from "@/common/features/projects/projects.factory"
import { evaluationConversationDatasetFactory } from "@/eval/features/evaluation-conversation-datasets/evaluation-conversation-datasets.factory"
import { agentMessageFeedbackFactory } from "@/studio/features/agent-message-feedback/agent-message-feedback.factory"
import { testCaseSourceFactory } from "@/studio/features/test-cases/test-cases.factory"
import type { TestCase } from "@/studio/features/test-cases/test-cases.models"

export const mockOrganization = organizationFactory.build({ id: "org-1" })

export const mockProject = projectFactory
  .transient({ organization: mockOrganization })
  .build({ id: "proj-1", name: "Demo project" })

export const mockAgent = agentFactory
  .transient({ project: mockProject })
  .build({ id: "agent-1", name: "Helpful Assistant", type: "conversation" })

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

export const mockMessages = [
  agentSessionMessageFactory.build({ id: "message-1", role: "user", content: firstUserMessage }),
  agentSessionMessageFactory.build({
    id: "message-2",
    role: "assistant",
    content: firstAnswer,
    agentId: mockAgent.id,
  }),
  agentSessionMessageFactory.build({ id: "message-3", role: "user", content: lastUserMessage }),
  agentSessionMessageFactory.build({
    id: "message-4",
    role: "assistant",
    content: savedAnswer,
    agentId: mockAgent.id,
  }),
]

/** The last answer of the conversation, one earlier turn behind it. */
export const mockTestCaseSource = testCaseSourceFactory.build({
  agentMessageId: "message-4",
  answer: savedAnswer,
  lastUserMessage,
  earlierTurnCount: 1,
})

/** The first answer: no earlier turn, so both input modes give the same input. */
export const mockFirstTurnTestCaseSource = testCaseSourceFactory.build({
  agentMessageId: "message-2",
  answer: firstAnswer,
  lastUserMessage: firstUserMessage,
  earlierTurnCount: 0,
})

export const mockFeedbacks = [
  agentMessageFeedbackFactory.transient({ agent: mockAgent, project: mockProject }).build({
    id: "feedback-1",
    agentMessageId: "message-4",
    agentMessageContent: savedAnswer,
    content: mockCritique,
  }),
]

const LLM_DELAY_MS = 900

const waitForLlm = () => new Promise((resolve) => setTimeout(resolve, LLM_DELAY_MS))

// Stands in for the LLM: replaces the personal data this conversation holds.
const anonymize = (text: string) =>
  text
    .replaceAll("Jordan Lee", "[name]")
    .replaceAll("Jordan", "[name]")
    .replaceAll("jordan.lee@example.com", "[email]")
    .replaceAll("March 3", "[date]")

/** The dialog's LLM calls and save, answering after a short wait so the pending states show. */
export function buildMockTestCaseCallbacks({ failDrafts = false }: { failDrafts?: boolean } = {}) {
  return {
    onDraftStandaloneQuestion: fn(async () => {
      await waitForLlm()
      if (failDrafts) throw new Error("The LLM did not answer")
      return standaloneQuestion
    }),
    onDraftExpectedOutput: fn(async (_critique: string) => {
      await waitForLlm()
      if (failDrafts) throw new Error("The LLM did not answer")
      return correctedAnswer
    }),
    onAnonymize: fn(async (text: string) => {
      await waitForLlm()
      return anonymize(text)
    }),
    onSave: fn(async (_testCase: TestCase) => {
      await waitForLlm()
    }),
  }
}
