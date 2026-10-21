import { z } from "zod"

/** The signed-in person, as `GET me` returns them. The Desk reads only these fields. */
export const meUserOutputSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.string(),
})

export const meOutputSchema = z.object({
  user: meUserOutputSchema,
})

export type MeUserOutputDto = z.output<typeof meUserOutputSchema>
export type MeOutputDto = z.output<typeof meOutputSchema>
