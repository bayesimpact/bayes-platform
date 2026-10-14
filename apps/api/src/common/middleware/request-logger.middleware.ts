import { Injectable, Logger, type NestMiddleware } from "@nestjs/common"
import type { NextFunction, Request, Response } from "express"

/**
 * Fields that carry credentials (OAuth codes, verifiers and tokens, client
 * secrets). Their values never reach the logs, even at debug level.
 */
const REDACTED_FIELDS = new Set([
  "access_token",
  "client_secret",
  "code",
  "code_verifier",
  "password",
  "refresh_token",
  "token",
])

export function redactCredentials(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactCredentials)
  if (value === null || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value).map(([key, fieldValue]) => [
      key,
      REDACTED_FIELDS.has(key) ? "[redacted]" : redactCredentials(fieldValue),
    ]),
  )
}

/**
 * NestJS middleware that logs incoming requests and their responses.
 * Similar to Rails' default request logging.
 *
 * Must be registered via AppModule.configure() so it runs AFTER body parsing.
 *
 * Example output:
 *   --> POST /invitations body: {"payload":{"targetType":"project","targetId":"..."}}
 *   <-- POST /invitations 201 45ms
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HTTP")

  use(request: Request, response: Response, next: NextFunction) {
    const { method, originalUrl, body, query } = request
    const startTime = Date.now()

    const parts = [`--> ${method} ${originalUrl}`]

    if (Object.keys(query).length > 0) {
      parts.push(`query: ${JSON.stringify(redactCredentials(query))}`)
    }

    if (body && Object.keys(body).length > 0) {
      parts.push(`body: ${JSON.stringify(redactCredentials(body))}`)
    }

    this.logger.debug(parts.join(" "))

    response.on("finish", () => {
      const duration = Date.now() - startTime
      this.logger.debug(`<-- ${method} ${originalUrl} ${response.statusCode} ${duration}ms`)
    })

    next()
  }
}
