import { useSuspenseQuery } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { evaluationProjectsQueryOptions } from "../api/queries"
import { NoEvaluationAccessPage } from "./NoEvaluationAccessPage"

export type EvaluationAccessGateProps = {
  children: ReactNode
}

/**
 * Opens the app to a person who can evaluate at least one project: who holds `evaluation.ui.read`
 * there, through the `project_evaluator` role. Anyone else gets a page that says why. The API
 * refuses the evaluation routes of a project to anyone without the permission there.
 */
export function EvaluationAccessGate({ children }: EvaluationAccessGateProps) {
  const { data: projects } = useSuspenseQuery(evaluationProjectsQueryOptions())
  if (projects.length === 0) return <NoEvaluationAccessPage />
  return children
}
