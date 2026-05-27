import { useCallback, useMemo } from "react"
import { useLocation } from "react-router-dom"
import { DeskRoutes } from "@/desk/routes/helpers"
import { EvalRoutes } from "@/eval/routes/helpers"
import { ReviewerRoutes } from "@/reviewer/routes/helpers"
import { StudioRoutes } from "@/studio/routes/helpers"
import { TesterRoutes } from "@/tester/routes/helpers"

export function useIsRoute() {
  const { pathname } = useLocation()
  const pathPieces = useMemo(() => {
    return getPathPieces(pathname)
  }, [pathname])

  const isRoute = useCallback(
    (routeName: string) => {
      const routePieces = getRoutePieces(routeName)
      return pathPieces === routePieces
    },
    [pathPieces],
  )

  return { isRoute }
}

function getPathPieces(pathname: string) {
  return pathname
    .split("/")
    .filter(Boolean)
    .filter((piece) => !idParamRegex.test(piece) && !appNames.has(piece))
    .toString()
}

const appNames = new Set(
  [DeskRoutes, StudioRoutes, EvalRoutes, TesterRoutes, ReviewerRoutes].map((routes) =>
    routes.home.path.slice(1),
  ),
)
function getRoutePieces(routeName: string) {
  let result = routeName
  for (const appName of appNames) {
    // Remove all interface home pieces from the route, so that we can match routes regardless of which interface we're in. For example, "/studio/documents" and "/desk/documents" should both match "documents".
    if (result.startsWith(`/${appName}`)) {
      result = result.replace(new RegExp(`^/${appName}`, "g"), "")
    }
  }
  const clean = result
    .split("/")
    .filter(Boolean)
    .filter((piece) => !piece.startsWith(":"))
    .toString()
  return clean
}

// 6b40119c-5c06-47ce-b28b-138c22e48c92
const idParamRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
