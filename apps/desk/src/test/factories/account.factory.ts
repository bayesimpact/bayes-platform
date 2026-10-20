import { type MeOutputDto, meOutputSchema } from "@caseai-connect/desk-contracts"
import type { z } from "zod"

/** A `GET desk/me` response, checked against the contract so a mock cannot drift from it. */
export function buildMe(overrides: Partial<z.input<typeof meOutputSchema>> = {}): MeOutputDto {
  const organizationId = crypto.randomUUID()
  return meOutputSchema.parse({
    user: { id: crypto.randomUUID(), name: "Alex Example", email: "alex@example.org" },
    projects: [
      {
        id: crypto.randomUUID(),
        name: "Pricing",
        organization: { id: organizationId, name: "Product" },
      },
      {
        id: crypto.randomUUID(),
        name: "Support",
        organization: { id: organizationId, name: "Product" },
      },
      {
        id: crypto.randomUUID(),
        name: "Help center",
        organization: { id: crypto.randomUUID(), name: "Operations" },
      },
    ],
    ...overrides,
  })
}
