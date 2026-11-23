import { z } from "zod"

/**
 * The texts the API narrows a list of records with, one per key: they travel as one JSON
 * parameter of the query.
 */
export const columnFiltersSchema = z.codec(z.string(), z.record(z.string(), z.string()), {
  decode: (text) => JSON.parse(text),
  encode: (filters) => JSON.stringify(filters),
})
