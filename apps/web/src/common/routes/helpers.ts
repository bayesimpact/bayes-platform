// Extract `:paramName` tokens from a path literal into a union of names.
type ExtractParamNames<Path extends string> = Path extends `${string}:${infer Param}/${infer Rest}`
  ? Param | ExtractParamNames<`/${Rest}`>
  : Path extends `${string}:${infer Param}`
    ? Param
    : never

type RouteParams<Path extends string> = [ExtractParamNames<Path>] extends [never]
  ? Record<string, never>
  : { [K in ExtractParamNames<Path>]: string }

type Route<Path extends string> = {
  path: Path
  build: (params: RouteParams<Path>) => string
  extend: <Suffix extends string>(suffix: Suffix) => Route<`${Path}${Suffix}`>
}

export function defineRoute<Path extends string>(path: Path): Route<Path> {
  return {
    path,
    build: (params) =>
      (Object.entries(params) as [string, string][]).reduce(
        (acc, [key, value]) => acc.replaceAll(`:${key}`, encodeURIComponent(value)),
        path as string,
      ),
    extend: (suffix) => defineRoute(`${path}${suffix}` as const),
  }
}

export enum RouteNames {
  HOME = "/",
  LOGOUT = "/logout",
  ONBOARDING = "/onboarding",
}
