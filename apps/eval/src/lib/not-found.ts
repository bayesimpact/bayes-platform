import { notFound } from "@tanstack/react-router"
import { z } from "zod"

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
