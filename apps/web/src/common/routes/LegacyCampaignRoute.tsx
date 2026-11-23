import { useEffect } from "react"
import { useLocation } from "react-router-dom"
import { toAppHref } from "@/config/runtime-config"
import { LoadingRoute } from "./LoadingRoute"
import { toEvaluationPath } from "./legacy-campaign-urls"
import { NotFoundRoute } from "./NotFoundRoute"

/**
 * A URL of the former tester or reviewer app: it opens the same page of the Evaluation app, an
 * app of its own, so with a full page load that replaces the URL in the history.
 */
export function LegacyCampaignRoute() {
  const { pathname } = useLocation()
  const evaluationPath = toEvaluationPath(pathname)

  useEffect(() => {
    if (evaluationPath) window.location.replace(toAppHref(evaluationPath))
  }, [evaluationPath])

  return evaluationPath ? <LoadingRoute /> : <NotFoundRoute />
}
