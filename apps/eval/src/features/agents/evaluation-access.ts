import { EVALUATION_UI_READ_PERMISSION } from "@bayes-platform/eval-contracts"
import { notFound } from "@tanstack/react-router"
import type { EvaluationAgent } from "./evaluation-agents"
import { hasProjectPermission } from "./evaluation-projects"

/**
 * Whether the person evaluates an agent, with its datasets and its runs: the `project_evaluator`
 * role of its project opens them, and the owners and admins do not hold it by default.
 */
export function canEvaluate(agent: EvaluationAgent): boolean {
  return hasProjectPermission(agent.project, EVALUATION_UI_READ_PERMISSION)
}

/** The evaluation pages of an agent are not found for a person who does not evaluate it. */
export function requireEvaluationAgent(agent: EvaluationAgent): void {
  if (!canEvaluate(agent)) throw notFound()
}
