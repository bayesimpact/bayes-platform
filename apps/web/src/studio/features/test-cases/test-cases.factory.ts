import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { TestCaseInputDraft, TestCaseSource } from "./test-cases.models"

class TestCaseSourceFactory extends Factory<TestCaseSource> {}

export const testCaseSourceFactory = TestCaseSourceFactory.define(({ params }) => ({
  agentMessageId: params.agentMessageId ?? faker.string.uuid(),
  answer: params.answer ?? faker.lorem.paragraph(),
  feedback: params.feedback ?? null,
}))

class TestCaseInputDraftFactory extends Factory<TestCaseInputDraft> {}

export const testCaseInputDraftFactory = TestCaseInputDraftFactory.define(({ params }) => ({
  inputMode: params.inputMode ?? "conversation",
  input: params.input ?? faker.lorem.sentence(),
  lastUserMessage: params.lastUserMessage ?? faker.lorem.sentence(),
  earlierTurnCount: params.earlierTurnCount ?? faker.number.int({ min: 1, max: 4 }),
}))
