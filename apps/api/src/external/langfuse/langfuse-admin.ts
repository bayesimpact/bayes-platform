import { Injectable, Logger } from "@nestjs/common"

/**
 * Thin client for the Langfuse public REST API operations the SDK does not
 * cover. Used by the conversation retention purge to delete traces (GDPR).
 * Auth and host come from the same env vars as the exporter
 * (LANGFUSE_PK / LANGFUSE_SK / LANGFUSE_BASE_URL).
 */
@Injectable()
export class LangfuseAdminService {
  private readonly logger = new Logger(LangfuseAdminService.name)

  isConfigured(): boolean {
    return Boolean(
      process.env.LANGFUSE_BASE_URL && process.env.LANGFUSE_PK && process.env.LANGFUSE_SK,
    )
  }

  /**
   * Deletes a trace (and its observations) from Langfuse. Resolves true when
   * the trace is gone (deleted now, already deleted, or never existed).
   */
  async deleteTrace(traceId: string): Promise<boolean> {
    if (!this.isConfigured()) {
      this.logger.warn(`Langfuse not configured; skipping trace deletion for ${traceId}.`)
      return false
    }
    const baseUrl = (process.env.LANGFUSE_BASE_URL as string).replace(/\/$/, "")
    const credentials = Buffer.from(
      `${process.env.LANGFUSE_PK}:${process.env.LANGFUSE_SK}`,
    ).toString("base64")

    const response = await fetch(`${baseUrl}/api/public/traces/${encodeURIComponent(traceId)}`, {
      method: "DELETE",
      headers: { Authorization: `Basic ${credentials}` },
    })
    if (response.ok || response.status === 404) return true
    throw new Error(
      `Langfuse trace deletion failed for ${traceId}: ${response.status} ${response.statusText}`,
    )
  }
}
