import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  InternalServerErrorException,
  Logger,
  type NestInterceptor,
} from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { Reflector } from "@nestjs/core"
import { map, type Observable } from "rxjs"
import { getSchemaRoute } from "./schema-route.metadata"

/**
 * Parses each response with the schema of its route before it leaves: unknown keys are stripped, so
 * no internal field leaks, and a response that does not match is logged and answered with a 500.
 */
@Injectable()
export class SchemaResponseInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SchemaResponseInterceptor.name)

  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const route = getSchemaRoute(this.reflector, context)
    return next.handle().pipe(
      map((response: unknown) => {
        const result = route.schemas.response.safeParse(response)
        if (!result.success) {
          // Paths and codes only: the values may hold personal data.
          this.logger.error("A response does not match the schema of its route", {
            route: `${route.method.toUpperCase()} ${route.path}`,
            issues: result.error.issues.map((issue) => ({
              path: issue.path.map(String).join("."),
              code: issue.code,
            })),
          })
          throw new InternalServerErrorException()
        }
        return result.data
      }),
    )
  }
}
