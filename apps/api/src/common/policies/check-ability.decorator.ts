import { SetMetadata } from "@nestjs/common"
import type { AppAction, AppSubject } from "@/domains/rbac/rbac-catalog"

/**
 * Resolves the subject instance for entity-bound checks (`update`, `delete`,
 * etc.). The function receives the request and returns the entity to be
 * authorized — typically a resource attached by `ResourceContextGuard` such
 * as `req.project` or `req.evaluation`. When omitted, the check is against
 * the subject TYPE only (e.g. `can("create", "Evaluation")`).
 */
// biome-ignore lint/suspicious/noExplicitAny: Request shape is per-controller, narrowed by the resolver.
export type AbilitySubjectResolver = (request: any) => object | undefined

export type CheckAbilityMetadata = {
  action: AppAction
  subjectType: AppSubject
  resolveSubject?: AbilitySubjectResolver
}

export const CHECK_ABILITY_KEY = "check_ability"

/**
 * Phase-3 cutover decorator. Replaces `@CheckPolicy((p) => p.canX())` +
 * per-domain `*Policy` + per-domain `*Guard` with a single
 * `(action, subjectType)` pair evaluated by `CaslAbilityGuard`.
 *
 * Usage:
 * ```ts
 * @CheckAbility("create", "Evaluation")                                  // no entity
 * @CheckAbility("update", "Evaluation", (req) => req.evaluation)        // entity-bound
 * ```
 */
export function CheckAbility(action: AppAction, subjectType: AppSubject): MethodDecorator
export function CheckAbility(
  action: AppAction,
  subjectType: AppSubject,
  resolveSubject: AbilitySubjectResolver,
): MethodDecorator
export function CheckAbility(
  action: AppAction,
  subjectType: AppSubject,
  resolveSubject?: AbilitySubjectResolver,
): MethodDecorator {
  const metadata: CheckAbilityMetadata = { action, subjectType, resolveSubject }
  return SetMetadata(CHECK_ABILITY_KEY, metadata)
}
