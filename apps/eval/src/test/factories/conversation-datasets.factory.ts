import {
  type ConversationDatasetOutputDto,
  type ConversationDatasetRecordOutputDto,
  conversationDatasetOutputSchema,
  conversationDatasetRecordOutputSchema,
} from "@caseai-connect/eval-contracts"
import { daysAgo } from "./review-campaigns.factory"

/** A conversation dataset of a project with its records, whole: the handlers page the records. */
export type ConversationDatasetRecord = {
  projectId: string
  dataset: Omit<ConversationDatasetOutputDto, "recordCount">
  records: ConversationDatasetRecordOutputDto[]
}

/** A record of a dataset, checked against the contract. */
export function buildConversationDatasetRecord(
  overrides: Partial<ConversationDatasetRecordOutputDto> = {},
): ConversationDatasetRecordOutputDto {
  return conversationDatasetRecordOutputSchema.parse({
    id: crypto.randomUUID(),
    input: "Which plan should a team of five pick?",
    expectedOutput: "The Pro plan: it includes five seats and shared workspaces.",
    comment: null,
    ...overrides,
  })
}

/** A dataset of a project with its records, checked against the contract. */
export function buildConversationDataset(
  projectId: string,
  overrides: Partial<Omit<ConversationDatasetOutputDto, "recordCount">> = {},
  records: ConversationDatasetRecordOutputDto[] = [],
): ConversationDatasetRecord {
  const dataset = conversationDatasetOutputSchema.omit({ recordCount: true }).parse({
    id: crypto.randomUUID(),
    name: "Pricing questions",
    createdAt: daysAgo(5),
    updatedAt: daysAgo(1),
    ...overrides,
  })
  return { projectId, dataset, records }
}

/** The questions of the main dataset: enough of them for a second page. */
const PRICING_QUESTIONS: [string, string, string | null][] = [
  [
    "Which plan should a team of five pick?",
    "The Pro plan: it includes five seats and shared workspaces.",
    null,
  ],
  ["Can we switch plan later?", "Yes, at any time, from the billing page.", null],
  [
    "Do you offer a discount for a yearly payment?",
    "Yes: two months free on every plan paid yearly.",
    "The agent used to answer with last year's discount.",
  ],
  ["Is there a free trial?", "Yes, 14 days on the Pro plan, with no card asked.", null],
  ["How do I add a seat?", "From Settings, then Team: each extra seat is billed pro rata.", null],
  ["Can I pay by bank transfer?", "Yes, on yearly plans, from the billing page.", null],
  ["What happens when a trial ends?", "The workspace moves to the Starter plan.", null],
  ["Do you bill in euros?", "Yes: in euros, dollars or pounds, set once per workspace.", null],
  ["How do I get an invoice?", "Each payment's invoice is in the billing page.", null],
  ["Can I cancel at any time?", "Yes: the plan then runs until the end of its period.", null],
  ["Is support included?", "Email support on every plan, chat support from Pro.", null],
  ["Do unused seats get refunded?", "No: a seat removed frees at the next renewal.", null],
]

/** The datasets of the main project: one with two pages of records, and an empty one. */
export function buildPricingDatasets(projectId: string): ConversationDatasetRecord[] {
  return [
    buildConversationDataset(
      projectId,
      {},
      PRICING_QUESTIONS.map(([input, expectedOutput, comment]) =>
        buildConversationDatasetRecord({ input, expectedOutput, comment }),
      ),
    ),
    buildConversationDataset(projectId, {
      name: "Onboarding questions",
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
    }),
  ]
}
