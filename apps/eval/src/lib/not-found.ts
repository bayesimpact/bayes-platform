import { notFound } from "@tanstack/react-router"
import { z } from "zod"
import { ApiError } from "./api-client"

/**
 * The statuses by which the API says a page's entity is not the person's to see: it does not
 * exist (404), it belongs to someone else (403), or its id names another kind of session (422).
 */
const NOT_FOUND_STATUSES = [403, 404, 422]

/** Loads a page's data; an entity the API says is not the person's makes the page not found. */
export async function orNotFound<TValue>(load: () => Promise<TValue>): Promise<TValue> {
  try {
    return await load()
  } catch (error) {
    if (error instanceof ApiError && NOT_FOUND_STATUSES.includes(error.status)) throw notFound()
    throw error
  }
}

/**
 * The `params.parse` of a route whose `$name` segments hold UUIDs: any other value makes the page
 * not found, before a loader sends it to the API.
 */
export function uuidParams<TName extends string>(...names: TName[]) {
  return <TParams extends Record<TName, string>>(params: TParams): TParams => {
    if (names.some((name) => !z.uuid().safeParse(params[name]).success)) throw notFound()
    return params
  }
}
