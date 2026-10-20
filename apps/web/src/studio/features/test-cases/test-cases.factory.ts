import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { TestCaseSource } from "./test-cases.models"

class TestCaseSourceFactory extends Factory<TestCaseSource> {}

export const testCaseSourceFactory = TestCaseSourceFactory.define(({ params }) => ({
  agentMessageId: params.agentMessageId ?? faker.string.uuid(),
  answer: params.answer ?? faker.lorem.paragraph(),
  lastUserMessage: params.lastUserMessage ?? faker.lorem.sentence(),
  earlierTurnCount: params.earlierTurnCount ?? faker.number.int({ min: 1, max: 4 }),
  feedback: params.feedback ?? null,
}))
