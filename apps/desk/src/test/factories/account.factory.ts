import { type MeOutputDto, meOutputSchema } from "@caseai-connect/desk-contracts"

/** A `GET me` response, checked against the contract so a mock cannot drift from it. */
export function buildMe(overrides: Partial<MeOutputDto["user"]> = {}): MeOutputDto {
  return meOutputSchema.parse({
    user: {
      id: crypto.randomUUID(),
      name: "Alex Example",
      email: "alex@example.org",
      termsAccepted: true,
      ...overrides,
    },
    currentTerms: {
      generalConditions: { url: "https://example.org/terms/general-conditions", version: 2 },
      privacyPolicy: { url: "https://example.org/terms/privacy-policy", version: 3 },
      aiUsagePolicy: { url: "https://example.org/terms/ai-usage-policy", version: 1 },
    },
  })
}
