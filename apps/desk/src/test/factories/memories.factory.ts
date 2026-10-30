import { type MemoryOutputDto, memoryOutputSchema } from "@caseai-connect/desk-contracts"
import { daysAgo } from "./agent-sessions.factory"

/** A fact an agent remembers about the person, or proposes to, checked against the contract. */
export function buildMemory(overrides: Partial<MemoryOutputDto> = {}): MemoryOutputDto {
  return memoryOutputSchema.parse({
    id: crypto.randomUUID(),
    content: "Works in a team of five",
    status: "saved",
    createdAt: daysAgo(0),
    ...overrides,
  })
}
