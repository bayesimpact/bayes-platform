import { z } from "zod"

/** Opens a project's Desk: the projects that grant it are the ones the Desk's home lists. */
export const DESK_UI_READ_PERMISSION = "desk.ui.read" as const

/** A project the signed-in person can read, as `GET projects/mine` returns it. */
export const myProjectOutputSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  organizationId: z.uuid(),
  /** The permission keys the person holds on the project. */
  permissions: z.array(z.string()),
})

export type MyProjectOutputDto = z.output<typeof myProjectOutputSchema>
