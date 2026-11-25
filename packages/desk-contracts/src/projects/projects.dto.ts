import { z } from "zod"

/**
 * Reading a project, and opening its Desk: the projects that grant `desk.ui.read` are the ones the
 * Desk's home lists.
 */
export { DESK_UI_READ_PERMISSION, PROJECT_READ_PERMISSION } from "@caseai-connect/permissions"

/** The feature of a project that shows the sources a reply relied on, under the reply. */
export const SOURCES_TOOL_FEATURE_FLAG = "sources-tool" as const

/** A project the signed-in person can read, as `GET desk/projects/mine` returns it. */
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
