import { z } from "zod"

/** An organization the signed-in person can read, as `GET organizations/mine` returns it. */
export const myOrganizationOutputSchema = z.object({
  id: z.uuid(),
  name: z.string(),
})

export type MyOrganizationOutputDto = z.output<typeof myOrganizationOutputSchema>
