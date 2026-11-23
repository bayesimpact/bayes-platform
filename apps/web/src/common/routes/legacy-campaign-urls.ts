import { matchPath } from "react-router-dom"
import { EvalRoutes } from "./eval-routes"

const campaign = "/o/:organizationId/p/:projectId/review-campaigns/:reviewCampaignId"

/** The former tester and reviewer apps, which this app served at these two paths. */
export const LEGACY_CAMPAIGN_APP_PATHS = ["/tester", "/reviewer"]

/** Each URL of the former tester and reviewer apps, with the page of the Evaluation app that replaces it. */
const redirects: { from: string; to: string }[] = [
  { from: "/tester", to: EvalRoutes.home.path },
  { from: `/tester${campaign}`, to: EvalRoutes.testerCampaign.path },
  { from: `/tester${campaign}/survey`, to: EvalRoutes.testerSurvey.path },
  { from: `/tester${campaign}/a/:agentId/as/:agentSessionId`, to: EvalRoutes.testerSession.path },
  { from: "/reviewer", to: EvalRoutes.home.path },
  { from: `/reviewer${campaign}`, to: EvalRoutes.reviewerCampaign.path },
  { from: `/reviewer${campaign}/report`, to: EvalRoutes.reviewerReport.path },
  { from: `/reviewer${campaign}/sessions/:agentSessionId`, to: EvalRoutes.reviewerSession.path },
]

/**
 * The page of the Evaluation app that replaces a URL of the former tester or reviewer app, or
 * none when no page of those apps had that URL. People of a campaign may have kept such a URL.
 */
export function toEvaluationPath(pathname: string): string | null {
  for (const redirect of redirects) {
    const match = matchPath(redirect.from, pathname)
    if (!match) continue
    return redirect.to.replace(/:(\w+)/g, (_token, name: string) =>
      encodeURIComponent(match.params[name] ?? ""),
    )
  }
  return null
}
