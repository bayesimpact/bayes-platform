import { z } from "zod"

/** One problem a schema found in a request, as the input guard reports it. */
export const errorIssueOutputSchema = z.object({
  path: z.array(z.union([z.string(), z.number()])),
  code: z.string(),
  message: z.string(),
})

/**
 * The body of an error response. A 400 from the input guard carries `issues`; other errors keep the
 * default body of NestJS, and a malformed (400) or oversized (413) JSON body carries neither `issues`
 * nor `error`.
 */
export const errorOutputSchema = z.object({
  statusCode: z.number(),
  message: z.union([z.string(), z.array(z.string())]),
  error: z.string().optional(),
  issues: z.array(errorIssueOutputSchema).optional(),
})

export type ErrorIssueOutputDto = z.output<typeof errorIssueOutputSchema>
export type ErrorOutputDto = z.output<typeof errorOutputSchema>
