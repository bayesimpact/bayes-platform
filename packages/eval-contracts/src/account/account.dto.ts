import { z } from "zod"

/** The signed-in person, as `GET eval/me` returns them. The app reads only these fields. */
export const meUserOutputSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.string(),
  /** What the person may do whatever the project, such as reading the traces of the agents. */
  globalPermissions: z.array(z.string()),
})

/** The permission to open the trace of an agent's answer: a global one. */
export { TRACE_READ_PERMISSION } from "@caseai-connect/permissions"

export const meOutputSchema = z.object({
  user: meUserOutputSchema,
})

export type MeUserOutputDto = z.output<typeof meUserOutputSchema>
export type MeOutputDto = z.output<typeof meOutputSchema>
