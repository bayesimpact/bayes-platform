import { z } from "zod"

/**
 * The permissions that read a project and open its apps: its evaluations, its Studio, the Desk,
 * and the tester's and reviewer's pages of its review campaigns (see the catalog).
 */
export {
  DESK_UI_READ_PERMISSION,
  EVALUATION_UI_READ_PERMISSION,
  PROJECT_READ_PERMISSION,
  REVIEWER_UI_READ_PERMISSION,
  STUDIO_UI_READ_PERMISSION,
  TESTER_UI_READ_PERMISSION,
} from "@bayes-platform/permissions"

/** A project the signed-in person can read, as `GET eval/projects/mine` returns it. */
export const myProjectOutputSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  organizationId: z.uuid(),
  /** The permission keys the person holds on the project. */
  permissions: z.array(z.string()),
})

export type MyProjectOutputDto = z.output<typeof myProjectOutputSchema>
