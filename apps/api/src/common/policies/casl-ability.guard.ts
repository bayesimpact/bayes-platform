import { subject as setSubjectType } from "@casl/ability"
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { Reflector } from "@nestjs/core"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AbilityFactory } from "@/domains/rbac/ability.factory"
import { CHECK_ABILITY_KEY, type CheckAbilityMetadata } from "./check-ability.decorator"

/**
 * Resolves `@CheckAbility(action, subjectType, resolveSubject?)` metadata on
 * the route handler, builds the user's `AppAbility` via `AbilityFactory`,
 * and rejects with 403 if the ability denies the action. Handlers without
 * the decorator pass through unchanged (other guards may still apply).
 *
 * Phase-3 replacement for per-domain `*Policy` + `*Guard` plumbing. Wire
 * with `@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CaslAbilityGuard)`
 * on the controller.
 */
@Injectable()
export class CaslAbilityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const metadata = this.reflector.getAllAndOverride<CheckAbilityMetadata | undefined>(
      CHECK_ABILITY_KEY,
      [context.getHandler(), context.getClass()],
    )
    // No `@CheckAbility` on this route — let other guards decide.
    if (!metadata) return true

    const request = context.switchToHttp().getRequest<{
      user: { id: string; email: string | null }
    }>()

    const ability = await this.abilityFactory.forUser(request.user)
    const allowed = metadata.resolveSubject
      ? this.evaluateWithEntity(ability, metadata, request)
      : ability.can(metadata.action, metadata.subjectType)

    if (!allowed) {
      throw new ForbiddenException(AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    }
    return true
  }

  private evaluateWithEntity(
    ability: Awaited<ReturnType<AbilityFactory["forUser"]>>,
    metadata: CheckAbilityMetadata,
    request: unknown,
  ): boolean {
    const instance = metadata.resolveSubject?.(request)
    // Entity-bound rules require an instance — missing one means the route
    // wasn't paired with the right `@AddContext(...)`. Deny rather than
    // silently pass the typed-subject check (which would only consult
    // rules with no `conditions`).
    if (!instance) return false
    return ability.can(metadata.action, setSubjectType(metadata.subjectType, instance))
  }
}
