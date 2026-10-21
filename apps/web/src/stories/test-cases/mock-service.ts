import { faker } from "@faker-js/faker"
import { testCaseInputDraftFactory } from "@/studio/features/test-cases/test-cases.factory"
import type { ITestCasesSpi } from "@/studio/features/test-cases/test-cases.spi"

const LLM_DELAY_MS = 900

const waitForLlm = () => new Promise((resolve) => setTimeout(resolve, LLM_DELAY_MS))

/**
 * The test case API for route stories: drafts come back after a short wait so the pending states
 * show, and `failDrafts` makes every LLM call fail.
 */
export function buildMockTestCasesService({
  failDrafts = false,
}: {
  failDrafts?: boolean
} = {}): ITestCasesSpi {
  const draftOrFail = async <T>(draft: () => T): Promise<T> => {
    await waitForLlm()
    if (failDrafts) throw new Error("The LLM did not answer")
    return draft()
  }
  return {
    async createOne({ target }) {
      await waitForLlm()
      return {
        datasetId: target.kind === "existing" ? target.datasetId : faker.string.uuid(),
        recordId: faker.string.uuid(),
      }
    },
    draftInput: ({ inputMode }) =>
      draftOrFail(() => {
        const lastUserMessage = faker.lorem.sentence()
        return testCaseInputDraftFactory.build({
          inputMode: inputMode ?? "conversation",
          input: inputMode === "lastMessage" ? lastUserMessage : faker.lorem.sentences(2),
          lastUserMessage,
        })
      }),
    draftExpectedOutput: () => draftOrFail(() => faker.lorem.paragraph()),
    anonymize: ({ text }) => draftOrFail(() => text),
  }
}
