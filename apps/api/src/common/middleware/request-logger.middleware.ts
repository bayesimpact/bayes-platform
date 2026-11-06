import { Injectable, Logger, type NestMiddleware } from "@nestjs/common"
import type { NextFunction, Request, Response } from "express"

/**
 * NestJS middleware that logs incoming requests and their responses.
 * Similar to Rails' default request logging.
 *
 * It writes the method and the path only, never the query string or the body: they carry what
 * people write to the agents and credentials such as OAuth codes, and a debug run in production
 * would copy them into the logs.
 *
 * Example output:
 *   --> POST /invitations
 *   <-- POST /invitations 201 45ms
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HTTP")

  use(request: Request, response: Response, next: NextFunction) {
    const { method } = request
    const path = withoutQueryString(request.originalUrl)
    const startTime = Date.now()

    this.logger.debug(`--> ${method} ${path}`)

    response.on("finish", () => {
      const duration = Date.now() - startTime
      this.logger.debug(`<-- ${method} ${path} ${response.statusCode} ${duration}ms`)
    })

    next()
  }
}

function withoutQueryString(url: string): string {
  const queryStart = url.indexOf("?")
  return queryStart === -1 ? url : url.slice(0, queryStart)
}
