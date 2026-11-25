import { z } from "zod"

/**
 * Opens a project's evaluations. The `project_evaluator` role grants it, never the organization:
 * the app opens for a person who holds it on at least one project.
 */
/** The permission to open the Studio of a project, where its agents are set up. */
export {
  EVALUATION_UI_READ_PERMISSION,
  STUDIO_UI_READ_PERMISSION,
} from "@caseai-connect/permissions"

/** A project the signed-in person can read, as `GET eval/projects/mine` returns it. */
export const myProjectOutputSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  organizationId: z.uuid(),
  /** The permission keys the person holds on the project. */
  permissions: z.array(z.string()),
})

export type MyProjectOutputDto = z.output<typeof myProjectOutputSchema>
