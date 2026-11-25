import { z } from "zod"

/** The permissions that open a project's evaluations and its Studio (see the catalog). */
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
