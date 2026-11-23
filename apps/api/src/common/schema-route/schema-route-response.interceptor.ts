import type { AnySchemaRoute } from "@caseai-connect/desk-contracts"
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
import { SCHEMA_ROUTE_METADATA_KEY } from "./schema-route.types"

/**
 * Parses the handler's answer with the response schema of its route before it leaves. Keys the
 * schema does not declare are stripped. A mismatch is logged with its issue paths and answers 500.
 */
@Injectable()
export class SchemaRouteResponseInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SchemaRouteResponseInterceptor.name)

  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const route = this.reflector.get<AnySchemaRoute | undefined>(
      SCHEMA_ROUTE_METADATA_KEY,
      context.getHandler(),
    )
    if (!route) {
      throw new Error(
        "SchemaRouteResponseInterceptor runs only on a handler declared with @SchemaRoute",
      )
    }

    return next.handle().pipe(
      map((answer) => {
        const result = route.schemas.response.safeParse(answer)
        if (result.success) return result.data

        const issuePaths = result.error.issues.map((issue) =>
          issue.path.length ? issue.path.map(String).join(".") : "(root)",
        )
        this.logger.error(
          `The response of ${route.method.toUpperCase()} ${route.path} breaks its schema at: ${issuePaths.join(", ")}`,
        )
        throw new InternalServerErrorException()
      }),
    )
  }
}
