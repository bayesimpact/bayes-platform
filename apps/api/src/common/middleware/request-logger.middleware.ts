import { Injectable, Logger, type NestMiddleware } from "@nestjs/common"
import type { NextFunction, Request, Response } from "express"

/**
 * NestJS middleware that logs incoming requests and their responses.
 * Similar to Rails' default request logging.
 *
 * Must be registered via AppModule.configure() so it runs AFTER body parsing.
 *
 * Example output:
 *   --> POST /member-grants body: {"payload":{"targetType":"project","targetId":"..."}}
 *   <-- POST /member-grants 201 45ms
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HTTP")

  use(request: Request, response: Response, next: NextFunction) {
    const { method, originalUrl, body, query } = request
    const startTime = Date.now()

    const parts = [`--> ${method} ${originalUrl}`]

    if (Object.keys(query).length > 0) {
      parts.push(`query: ${JSON.stringify(query)}`)
    }

    if (body && Object.keys(body).length > 0) {
      parts.push(`body: ${JSON.stringify(body)}`)
    }

    this.logger.debug(parts.join(" "))

    response.on("finish", () => {
      const duration = Date.now() - startTime
      this.logger.debug(`<-- ${method} ${originalUrl} ${response.statusCode} ${duration}ms`)
    })

    next()
  }
}
