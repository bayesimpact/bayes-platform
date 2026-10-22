import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { Reflector } from "@nestjs/core"
import { from, map, mergeMap, type Observable, of } from "rxjs"
import type { EndpointRequest } from "@/common/context/request.interface"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ActivitiesService } from "./activities.service"
import {
  TRACK_ACTIVITY_METADATA_KEY,
  type TrackActivityEntityFrom,
  type TrackActivityOptions,
} from "./track-activity.decorator"

const MEMBER_ENTITIES: ReadonlySet<TrackActivityEntityFrom> = new Set([
  "memberProjectMembership",
  "memberAgentMembership",
])

@Injectable()
export class ActivitiesInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly activitiesService: ActivitiesService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const trackOptions = this.reflector.getAllAndOverride<TrackActivityOptions>(
      TRACK_ACTIVITY_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    )

    if (!trackOptions) {
      return next.handle()
    }

    const request = context.switchToHttp().getRequest<EndpointRequest & Record<string, unknown>>()

    return next.handle().pipe(
      mergeMap((handlerResult) => {
        const userId = this.getUserId(request)
        if (userId === null) {
          return of(handlerResult)
        }

        const { entityId, entityType } = this.getEntityFromContext(request, trackOptions.entityFrom)
        const organizationId = this.getOrganizationId(request)
        const projectId = this.getProjectId(request)

        return from(
          this.activitiesService.createActivity({
            action: trackOptions.action,
            userId,
            organizationId,
            projectId,
            entityId,
            entityType,
          }),
        ).pipe(map(() => handlerResult))
      }),
    )
  }

  private getOrganizationId(request: Record<string, unknown>): string | null {
    const value = request.organizationId
    return typeof value === "string" ? value : null
  }

  private getUserId(request: Record<string, unknown>): string | null {
    const user = request.user
    if (user && typeof user === "object" && "id" in user) {
      const userId = (user as { id: unknown }).id
      if (typeof userId === "string") {
        return userId
      }
    }

    const activityUserId = request.activityUserId
    return typeof activityUserId === "string" ? activityUserId : null
  }

  private getProjectId(request: Record<string, unknown>): string | null {
    const project = request.project
    if (project && typeof project === "object" && "id" in project) {
      const id = (project as { id: unknown }).id
      return typeof id === "string" ? id : null
    }
    return null
  }

  private getEntityFromContext(
    request: Record<string, unknown>,
    entityFrom: TrackActivityEntityFrom | undefined,
  ): {
    entityId: string | null
    entityType: string | null
  } {
    if (entityFrom === undefined) {
      return { entityId: null, entityType: null }
    }

    const value = request[entityFrom]
    // A member has no id of its own: the person and the resource identify it, so the activity
    // records the person.
    if (MEMBER_ENTITIES.has(entityFrom)) {
      const userId = (value as { userId?: unknown } | undefined)?.userId
      return typeof userId === "string"
        ? { entityId: userId, entityType: entityFrom }
        : { entityId: null, entityType: null }
    }
    if (
      value &&
      typeof value === "object" &&
      "id" in value &&
      typeof (value as { id: unknown }).id === "string"
    ) {
      return {
        entityId: (value as { id: string }).id,
        entityType: entityFrom,
      }
    }

    return { entityId: null, entityType: null }
  }
}
