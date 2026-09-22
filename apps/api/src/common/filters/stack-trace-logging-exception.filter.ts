import { inspect } from "node:util"
import { type ArgumentsHost, Catch, HttpException, Logger } from "@nestjs/common"
import { BaseExceptionFilter } from "@nestjs/core"

/**
 * Logs every exception that reaches the HTTP layer, then lets Nest build the
 * response.
 *
 * Client errors (4xx: a route that does not exist, a rejected token, an
 * invalid body) are logged as warnings without a stack: they describe the
 * request, not a fault of the API, and a vulnerability scanner hitting
 * `/.env` and `/phpinfo.php` must not open the "error logs" alert. Server
 * errors and non-HTTP exceptions keep the error level and the stack trace.
 */
@Catch()
export class StackTraceLoggingExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(StackTraceLoggingExceptionFilter.name)

  override catch(exception: unknown, host: ArgumentsHost): void {
    const requestInfo = this.formatRequestInfo(host)
    if (exception instanceof HttpException && exception.getStatus() < 500) {
      this.logger.warn(`${exception.message}${requestInfo}`)
    } else if (exception instanceof Error) {
      this.logger.error(`${exception.message}${requestInfo}`, exception.stack)
    } else {
      this.logger.error(`Non-Error exception thrown: ${inspect(exception)}${requestInfo}`)
    }

    super.catch(exception, host)
  }

  private formatRequestInfo(host: ArgumentsHost): string {
    if (host.getType() !== "http") return ""
    const request = host.switchToHttp().getRequest<{ method?: string; url?: string }>()
    if (!request?.method || !request?.url) return ""
    return ` (${request.method} ${request.url})`
  }
}
