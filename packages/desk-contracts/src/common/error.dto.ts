import { z } from "zod"

/**
 * The body of an error response: NestJS's default one. `message` is a list when the global
 * validation pipe refuses a body, and `error` is absent from a malformed (400) or an oversized
 * (413) JSON body.
 */
export const errorOutputSchema = z.object({
  statusCode: z.number(),
  message: z.union([z.string(), z.array(z.string())]),
  error: z.string().optional(),
})

export type ErrorOutputDto = z.output<typeof errorOutputSchema>
