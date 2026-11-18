import type { ReactNode } from "react"
import { useEvaluationWorkspace } from "../hooks/use-evaluation-workspace"
import { NoEvaluationAccessPage } from "./NoEvaluationAccessPage"

export type EvaluationAccessGateProps = {
  children: ReactNode
}

/**
 * Opens the app to a person it holds something for: a project they evaluate (`evaluation.ui.read`,
 * from the `project_evaluator` role) or whose review campaigns they manage
 * (`project.review_campaign.read`, held by its owners and admins), or a campaign they test or
 * review. Anyone else gets a page that says why. The API checks each route on its own.
 */
export function EvaluationAccessGate({ children }: EvaluationAccessGateProps) {
  const { projects, myCampaigns } = useEvaluationWorkspace()
  if (projects.length === 0 && myCampaigns.length === 0) return <NoEvaluationAccessPage />
  return children
}
