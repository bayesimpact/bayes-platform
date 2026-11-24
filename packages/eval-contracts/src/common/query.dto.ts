import { z } from "zod"

/**
 * The texts the API narrows a list of records with, one per key: they travel as one JSON
 * parameter of the query.
 */
export const columnFiltersSchema = z.codec(z.string(), z.record(z.string(), z.string()), {
  decode: (text) => JSON.parse(text),
  encode: (filters) => JSON.stringify(filters),
})

/** A whole number of the query, sent as text. An empty text is refused: `Number("")` is 0. */
export const queryNumberSchema = (numberSchema: z.ZodNumber) =>
  z.codec(z.string().trim().min(1), numberSchema, {
    decode: (text) => Number(text),
    encode: (value) => String(value),
  })
