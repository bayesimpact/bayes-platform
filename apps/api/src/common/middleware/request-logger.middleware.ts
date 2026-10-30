import { Injectable, Logger, type NestMiddleware } from "@nestjs/common"
import type { NextFunction, Request, Response } from "express"
import { redactCredentials, redactUrl } from "../logger/log-redaction"

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
    const { method, body, query } = request
    const url = redactUrl(request.originalUrl)
    const startTime = Date.now()

    const parts = [`--> ${method} ${url}`]

    if (Object.keys(query).length > 0) {
      parts.push(`query: ${JSON.stringify(redactCredentials(query))}`)
    }

    if (body && Object.keys(body).length > 0) {
      parts.push(`body: ${JSON.stringify(redactCredentials(body))}`)
    }

    this.logger.debug(parts.join(" "))

    response.on("finish", () => {
      const duration = Date.now() - startTime
      this.logger.debug(`<-- ${method} ${url} ${response.statusCode} ${duration}ms`)
    })

    next()
  }
}
