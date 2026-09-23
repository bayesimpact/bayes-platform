import type { RequestPayload } from "./generic"

type GetPath = (options?: Record<string, string>) => string
type Method = "get" | "post" | "put" | "delete" | "patch"
type Return<TMethod extends Method, TResponse> = {
  path: string
  getPath: GetPath
  response: TResponse
  method: TMethod
}

export function defineRoute<
  TResponse extends object,
  TRequest extends RequestPayload<unknown> = RequestPayload<unknown>,
>(def: { path: string; method: Method }): Return<Method, TResponse> & { request: TRequest } {
  const normalizedPath = def.path.startsWith("/") ? def.path : `/${def.path}`
  return {
    ...def,
    path: normalizedPath,
    getPath: (options?: Record<string, string>) =>
      options ? interpolatePath(normalizedPath, options) : normalizedPath,
    request: {} as TRequest,
    response: {} as TResponse,
  }
}

function interpolatePath(path: string, options: Record<string, string>) {
  return path.replace(/:(\w+)/g, (match, p1: string) => options[p1] || match)
}

export type ApiRoute = {
  getPath: GetPath
  response: object
  request?: object
  method: "post" | "put" | "patch" | "get" | "delete"
}
