import { z } from "zod"

/**
 * Opens a project's evaluations. The `project_evaluator` role grants it, never the organization:
 * the app opens for a person who holds it on at least one project.
 */
export const EVALUATION_UI_READ_PERMISSION = "evaluation.ui.read" as const

/** A project the signed-in person can read, as `GET projects/mine` returns it. */
export const myProjectOutputSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  organizationId: z.uuid(),
  /** The permission keys the person holds on the project. */
  permissions: z.array(z.string()),
})

export type MyProjectOutputDto = z.output<typeof myProjectOutputSchema>
