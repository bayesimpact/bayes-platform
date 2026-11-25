import { z } from "zod"

const columnFiltersOutputSchema = z.record(z.string(), z.string())

/**
 * The texts the API narrows a list of records with, one per key: they travel as one JSON
 * parameter of the query. A text that is not JSON, or not an object of texts, is a schema issue.
 */
export const columnFiltersSchema = z.codec(z.string(), columnFiltersOutputSchema, {
  decode: (text, context) => {
    try {
      return JSON.parse(text)
    } catch {
      context.issues.push({ code: "custom", message: "columnFilters is not JSON", input: text })
      return z.NEVER
    }
  },
  encode: (filters) => JSON.stringify(filters),
})

/** A whole number of the query, sent as text. An empty text is refused: `Number("")` is 0. */
export const queryNumberSchema = (numberSchema: z.ZodNumber) =>
  z.codec(z.string().trim().min(1), numberSchema, {
    decode: (text) => Number(text),
    encode: (value) => String(value),
  })
