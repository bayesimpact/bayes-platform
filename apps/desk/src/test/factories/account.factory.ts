import { type MeOutputDto, meOutputSchema } from "@caseai-connect/desk-contracts"

/** A `GET me` response, checked against the contract so a mock cannot drift from it. */
export function buildMe(overrides: Partial<MeOutputDto["user"]> = {}): MeOutputDto {
  return meOutputSchema.parse({
    user: {
      id: crypto.randomUUID(),
      name: "Alex Example",
      email: "alex@example.org",
      ...overrides,
    },
  })
}
