import { Injectable } from "@nestjs/common"
import type { IFileStorage } from "../storage/file-storage.interface"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PdfConverterClient } from "./pdf-converter.client"

/**
 * Rendered-pdf-pages orchestration for image-only models (Gemma, MedGemma):
 * pages live in GCS at {org}/{proj}/derived/{sourceId}/page-{n}.png, rendered
 * once by the pdf-converter service and cached via the owning row's
 * pdf_page_count column. The model fetches pages through temporary signed
 * storage URLs, so no image bytes ever transit this process.
 */
@Injectable()
export class PdfPagesService {
  constructor(private readonly pdfConverterClient: PdfConverterClient) {}

  derivedPagesPrefix(storageRelativePath: string): string {
    const lastSlashIndex = storageRelativePath.lastIndexOf("/")
    // lastIndexOf returns -1 for a bare filename: keep the derived tree at the root then.
    const directoryPrefix =
      lastSlashIndex === -1 ? "" : `${storageRelativePath.slice(0, lastSlashIndex)}/`
    const baseName = storageRelativePath.slice(lastSlashIndex + 1).replace(/\.[^.]+$/, "")
    return `${directoryPrefix}derived/${baseName}/`
  }

  pageObjectPath(storageRelativePath: string, pageNumber: number): string {
    return `${this.derivedPagesPrefix(storageRelativePath)}page-${pageNumber}.png`
  }

  /**
   * Removes the rendered page images of a document from storage. The cached
   * page count is the record of which pages exist: a null or zero count means
   * nothing was ever rendered (or persisted), so there is nothing to delete.
   */
  async deleteRenderedPages({
    document: { storageRelativePath, pdfPageCount },
    fileStorageService,
  }: {
    document: { storageRelativePath: string; pdfPageCount: number | null }
    fileStorageService: IFileStorage
  }): Promise<void> {
    if (!pdfPageCount) return

    await Promise.all(
      Array.from({ length: pdfPageCount }, (_, index) =>
        fileStorageService.deleteFile(this.pageObjectPath(storageRelativePath, index + 1)),
      ),
    )
  }

  async getImageUrls({
    document: { storageRelativePath, pdfPageCount },
    onPageCountUpdate,
    fileStorageService,
  }: {
    document: { storageRelativePath: string; pdfPageCount: number | null }
    onPageCountUpdate: (pdfPageCount: number) => Promise<void>
    fileStorageService: IFileStorage
  }): Promise<string[]> {
    // A zero count is never trusted: the converter client throws on zero-page
    // pdfs before anything is persisted, so a cached 0 predates that guard
    // and must be re-checked instead of silently producing zero image parts.
    if (pdfPageCount === null || pdfPageCount === 0) {
      // If the PDF page count is not known, render the document to determine it.
      pdfPageCount = await this.pdfConverterClient.generatePdfPageImages({
        sourceObject: storageRelativePath,
        outputPrefix: this.derivedPagesPrefix(storageRelativePath),
      })
      await onPageCountUpdate(pdfPageCount)
    }

    // Generate temporary URLs for each rendered page of the PDF.
    return Promise.all(
      Array.from({ length: pdfPageCount }, (_, index) => {
        const pageNumber = index + 1
        const pageObjectPath = this.pageObjectPath(storageRelativePath, pageNumber)
        return fileStorageService.getTemporaryUrl(pageObjectPath)
      }),
    )
  }
}
