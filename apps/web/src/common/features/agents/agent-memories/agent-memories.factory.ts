import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { AgentMemory } from "./agent-memories.models"

class AgentMemoryFactory extends Factory<AgentMemory> {
  /** A fact the agent inferred, waiting for the user's approval. */
  pending() {
    return this.params({ status: "pending", origin: "inferred" })
  }
}

export const agentMemoryFactory = AgentMemoryFactory.define(({ params }) => ({
  id: params.id ?? faker.string.uuid(),
  content: params.content ?? faker.lorem.sentence(),
  origin: params.origin ?? "user_request",
  status: params.status ?? "saved",
  sourceSessionId: params.sourceSessionId ?? null,
  createdAt: params.createdAt ?? faker.date.past().getTime(),
  updatedAt: params.updatedAt ?? faker.date.recent().getTime(),
}))
