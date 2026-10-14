import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from "@nestjs/common"
import type { Response } from "express"

/** RFC 6749 section 5.2 and RFC 7591 section 3.2.2 error codes the server answers with. */
export type OAuthErrorCode =
  | "invalid_request"
  | "invalid_client"
  | "invalid_grant"
  | "unsupported_grant_type"
  | "invalid_target"
  | "invalid_client_metadata"
  | "access_denied"

const STATUS_BY_ERROR: Record<OAuthErrorCode, number> = {
  invalid_request: 400,
  invalid_client: 401,
  invalid_grant: 400,
  unsupported_grant_type: 400,
  invalid_target: 400,
  invalid_client_metadata: 400,
  access_denied: 403,
}

export class OAuthProtocolError extends Error {
  constructor(
    readonly error: OAuthErrorCode,
    readonly description?: string,
  ) {
    super(description ?? error)
    this.name = "OAuthProtocolError"
  }

  get status(): number {
    return STATUS_BY_ERROR[this.error]
  }
}

/**
 * Answers the protocol endpoints in the OAuth error format
 * (`{ error, error_description }`, no caching) instead of Nest's, for every
 * error: a client only reads that format, even for a server fault.
 */
@Catch()
export class OAuthProtocolErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(OAuthProtocolErrorFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>()
    response.setHeader("Cache-Control", "no-store")
    if (exception instanceof OAuthProtocolError) {
      this.logger.warn(`OAuth ${exception.error}: ${exception.message}`)
      response.status(exception.status).json({
        error: exception.error,
        ...(exception.description && { error_description: exception.description }),
      })
      return
    }
    if (exception instanceof HttpException) {
      // Rate limits (429) and other HTTP errors keep their status and headers.
      response.status(exception.getStatus()).json({
        error: exception.getStatus() === 429 ? "slow_down" : "invalid_request",
        error_description: exception.message,
      })
      return
    }
    // A fault of the server (a signing key that does not load, the database):
    // the details stay in the logs, the client gets the standard error.
    this.logger.error(
      `OAuth server error: ${exception instanceof Error ? exception.message : String(exception)}`,
      exception instanceof Error ? exception.stack : undefined,
    )
    response.status(500).json({ error: "server_error" })
  }
}
