import { Injectable } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { GoogleIdTokenService, isGoogleIamAuthEnabled } from "@/external/google-iam"
import { PdfHasNoPagesError } from "./pdf-has-no-pages.error"
import { PdfPageLimitExceededError } from "./pdf-page-limit-exceeded.error"

// Guards against oversized vision requests: each page becomes one image sent
// to the model, so unbounded PDFs would blow up the request payload.
export const MAX_PDF_PAGES_FOR_IMAGE_CONVERSION = 20

// A malicious or degenerate pdf can declare an arbitrarily large page size;
// rasterizing it at full scale would allocate width*height*4 bytes per page.
export const MAX_RENDERED_PIXELS_PER_PAGE = 4_000_000

// Rendering happens once per document (cached in pdf_page_count) so a generous
// timeout is fine; the converter aborts stuck renders itself after
// PDF_CONVERTER_RENDER_TIMEOUT_MS (60s default), well within this budget.
const RENDER_REQUEST_TIMEOUT_MS = 120_000

// AbortSignal.timeout can fire while awaiting fetch() or later while reading
// the response body; both reject with a DOMException named TimeoutError. The
// DOMException may come from another realm (e.g. under Jest's VM sandbox), so
// match on name instead of instanceof.
const isTimeoutError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as { name?: unknown }).name === "TimeoutError"

const timeoutError = (path: string): Error =>
  new Error(`pdf-converter request to /${path} timed out after ${RENDER_REQUEST_TIMEOUT_MS}ms`)

@Injectable()
export class PdfConverterClient {
  constructor(private readonly googleIdTokenService: GoogleIdTokenService) {}

  // Renders a PDF document into individual page images.
  // Returns the number of pages rendered. Throws PdfPageLimitExceededError
  // (user-facing message) when the document has more pages than image-only
  // models accept: the converter counts pages first and rejects with a 422
  // before rendering anything. Throws PdfHasNoPagesError (also user-facing)
  // when the converter reports a zero-page pdf, so 0 is never returned.
  async generatePdfPageImages({
    sourceObject,
    outputPrefix,
  }: {
    sourceObject: string
    outputPrefix: string
  }): Promise<number> {
    const rendered = await this.postToConverter("render-document", {
      sourceObject,
      outputPrefix,
      maxPages: MAX_PDF_PAGES_FOR_IMAGE_CONVERSION,
      maxPixelsPerPage: MAX_RENDERED_PIXELS_PER_PAGE,
    })
    // The converter returns a 200 with pageCount 0 for a zero-page pdf; if
    // that were returned, the caller would cache it and every later run would
    // silently send the model no page images at all.
    if (rendered.pageCount === 0) {
      throw new PdfHasNoPagesError()
    }
    return rendered.pageCount
  }

  private async postToConverter(
    path: string,
    payload: Record<string, unknown>,
  ): Promise<{ pageCount: number }> {
    const converterUrl = this.resolveConverterUrl()
    const endpoint = new URL(path, converterUrl.endsWith("/") ? converterUrl : `${converterUrl}/`)
    let response: Response
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await this.buildAuthHeaders(converterUrl)),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(RENDER_REQUEST_TIMEOUT_MS),
      })
    } catch (error) {
      if (isTimeoutError(error)) throw timeoutError(path)
      const reason = error instanceof Error ? error.message : String(error)
      throw new Error(`could not reach pdf-converter at ${converterUrl}: ${reason}`)
    }
    if (!response.ok) {
      throw await this.buildErrorFromResponse(response)
    }
    let body: unknown
    try {
      body = await response.json()
    } catch (error) {
      if (isTimeoutError(error)) throw timeoutError(path)
      throw new Error(`pdf-converter returned a non-json response from /${path}`)
    }
    // A misconfigured PDF_CONVERTER_URL or intercepting proxy can return a 200
    // with a different shape; an undefined pageCount would pass the page-limit
    // check and silently render zero pages, so it must fail loudly here.
    const pageCount = (body as { pageCount?: unknown } | null)?.pageCount
    if (typeof pageCount !== "number" || !Number.isInteger(pageCount) || pageCount < 0) {
      throw new Error(`pdf-converter response from /${path} did not include a valid pageCount`)
    }
    return { pageCount }
  }

  private resolveConverterUrl(): string {
    const url = process.env.PDF_CONVERTER_URL
    if (!url) {
      throw new Error(
        "PDF_CONVERTER_URL is not set: converting pdfs to images for Gemma and MedGemma requires the pdf-converter service (apps/pdf-converter)",
      )
    }
    return url
  }

  // In production the pdf-converter is locked behind Cloud Run invoker IAM:
  // requests must carry a Google ID token minted for the service URL. Terraform
  // sets PDF_CONVERTER_AUTH=google-iam on the API and workers; locally the
  // converter runs open and no header is sent.
  private async buildAuthHeaders(converterUrl: string): Promise<Record<string, string>> {
    if (!isGoogleIamAuthEnabled(process.env.PDF_CONVERTER_AUTH)) {
      return {}
    }
    // The audience must be the Cloud Run service root URL, not the full path.
    return {
      Authorization: await this.googleIdTokenService.getAuthorizationHeader(
        new URL(converterUrl).origin,
      ),
    }
  }

  private async buildErrorFromResponse(response: Response): Promise<Error> {
    let body: { message?: string | string[]; pageCount?: number } = {}
    try {
      body = (await response.json()) as typeof body
    } catch {
      // Non-json error body: fall through to the generic message.
    }
    // 422 is the converter's page-limit rejection; its body carries the
    // document's page count so the typed error can name it.
    if (response.status === 422 && typeof body.pageCount === "number") {
      return new PdfPageLimitExceededError(body.pageCount, MAX_PDF_PAGES_FOR_IMAGE_CONVERSION)
    }
    if (typeof body.message === "string") return new Error(body.message)
    if (Array.isArray(body.message)) return new Error(body.message.join(", "))
    return new Error(`pdf-converter responded with HTTP ${response.status}`)
  }
}
