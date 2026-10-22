import { z } from "zod"

/** Opens a project's Desk: the projects that grant it are the ones the Desk's home lists. */
export const DESK_UI_READ_PERMISSION = "desk.ui.read" as const

/** The feature of a project that shows the sources a reply relied on, under the reply. */
export const SOURCES_TOOL_FEATURE_FLAG = "sources-tool" as const

/** A project the signed-in person can read, as `GET projects/mine` returns it. */
export const myProjectOutputSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  organizationId: z.uuid(),
  /** The permission keys the person holds on the project. */
  permissions: z.array(z.string()),
  /** The feature flags turned on for the project, such as `sources-tool`. */
  featureFlags: z.array(z.string()),
})

export type MyProjectOutputDto = z.output<typeof myProjectOutputSchema>
