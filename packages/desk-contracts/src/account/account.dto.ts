import { z } from "zod"

export const meUserOutputSchema = z.object({
  id: z.uuid(),
  name: z.string().nullable(),
  email: z.string(),
})

export const meProjectOutputSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  organization: z.object({
    id: z.uuid(),
    name: z.string(),
  }),
})

/** The signed-in person and the projects where they hold `desk.ui.read`. */
export const meOutputSchema = z.object({
  user: meUserOutputSchema,
  projects: z.array(meProjectOutputSchema),
})

export type MeUserOutputDto = z.output<typeof meUserOutputSchema>
export type MeProjectOutputDto = z.output<typeof meProjectOutputSchema>
export type MeOutputDto = z.output<typeof meOutputSchema>
