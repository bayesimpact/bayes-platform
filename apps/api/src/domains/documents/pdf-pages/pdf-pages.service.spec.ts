import { GoogleIdTokenService } from "@/external/google-iam"
import type { IFileStorage } from "../storage/file-storage.interface"
import { PdfConverterClient } from "./pdf-converter.client"
import { PdfHasNoPagesError } from "./pdf-has-no-pages.error"
import { PdfPageLimitExceededError } from "./pdf-page-limit-exceeded.error"
import { PdfPagesService } from "./pdf-pages.service"

describe("PdfPagesService", () => {
  const buildService = () => new PdfPagesService(new PdfConverterClient(new GoogleIdTokenService()))

  const buildFileStorageService = () =>
    ({
      getTemporaryUrl: jest.fn((storageRelativePath: string) =>
        Promise.resolve(`https://storage.example.test/${storageRelativePath}?signature=abc`),
      ),
      deleteFile: jest.fn(() => Promise.resolve()),
    }) as unknown as IFileStorage

  afterEach(() => {
    jest.restoreAllMocks()
    delete process.env.PDF_CONVERTER_URL
  })

  it("derives the pages prefix from the source path", () => {
    expect(buildService().derivedPagesPrefix("org1/proj1/doc1.pdf")).toBe(
      "org1/proj1/derived/doc1/",
    )
  })

  it("derives a root-level pages prefix when the source path has no directory", () => {
    expect(buildService().derivedPagesPrefix("doc1.pdf")).toBe("derived/doc1/")
  })

  it("builds the page object path", () => {
    expect(buildService().pageObjectPath("org1/proj1/doc1.pdf", 3)).toBe(
      "org1/proj1/derived/doc1/page-3.png",
    )
  })

  it("deletes every rendered page when the page count is cached", async () => {
    const fileStorageService = buildFileStorageService()

    await buildService().deleteRenderedPages({
      document: { storageRelativePath: "org1/proj1/doc1.pdf", pdfPageCount: 3 },
      fileStorageService,
    })

    expect(fileStorageService.deleteFile).toHaveBeenCalledTimes(3)
    expect(fileStorageService.deleteFile).toHaveBeenCalledWith("org1/proj1/derived/doc1/page-1.png")
    expect(fileStorageService.deleteFile).toHaveBeenCalledWith("org1/proj1/derived/doc1/page-2.png")
    expect(fileStorageService.deleteFile).toHaveBeenCalledWith("org1/proj1/derived/doc1/page-3.png")
  })

  it.each([
    null,
    0,
  ])("deletes nothing when the page count is %s because no page was rendered", async (pdfPageCount) => {
    const fileStorageService = buildFileStorageService()

    await buildService().deleteRenderedPages({
      document: { storageRelativePath: "org1/proj1/doc1.pdf", pdfPageCount },
      fileStorageService,
    })

    expect(fileStorageService.deleteFile).not.toHaveBeenCalled()
  })

  it("returns one signed url per page without calling the converter when the count is cached", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch")
    const onPageCountUpdate = jest.fn()

    const imageUrls = await buildService().getImageUrls({
      document: { storageRelativePath: "org1/proj1/doc1.pdf", pdfPageCount: 2 },
      onPageCountUpdate,
      fileStorageService: buildFileStorageService(),
    })

    expect(imageUrls).toEqual([
      "https://storage.example.test/org1/proj1/derived/doc1/page-1.png?signature=abc",
      "https://storage.example.test/org1/proj1/derived/doc1/page-2.png?signature=abc",
    ])
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(onPageCountUpdate).not.toHaveBeenCalled()
  })

  it("renders the document and reports the count when it is not cached", async () => {
    process.env.PDF_CONVERTER_URL = "http://pdf-converter.test"
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ pageCount: 2 }), { status: 200 })),
      )
    const onPageCountUpdate = jest.fn()

    const imageUrls = await buildService().getImageUrls({
      document: { storageRelativePath: "org1/proj1/doc1.pdf", pdfPageCount: null },
      onPageCountUpdate,
      fileStorageService: buildFileStorageService(),
    })

    expect(imageUrls).toEqual([
      "https://storage.example.test/org1/proj1/derived/doc1/page-1.png?signature=abc",
      "https://storage.example.test/org1/proj1/derived/doc1/page-2.png?signature=abc",
    ])
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [renderUrl, renderInit] = fetchSpy.mock.calls[0]!
    expect(String(renderUrl)).toBe("http://pdf-converter.test/render-document")
    expect(JSON.parse(String(renderInit?.body))).toEqual({
      sourceObject: "org1/proj1/doc1.pdf",
      outputPrefix: "org1/proj1/derived/doc1/",
      maxPages: 20,
      maxPixelsPerPage: 4_000_000,
    })
    expect(onPageCountUpdate).toHaveBeenCalledWith(2)
  })

  it("throws a user-facing error when the converter rejects the pdf over the page limit", async () => {
    process.env.PDF_CONVERTER_URL = "http://pdf-converter.test"
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "page limit exceeded: pdf has 25 pages, max is 20",
          pageCount: 25,
        }),
        { status: 422 },
      ),
    )
    const onPageCountUpdate = jest.fn()

    const imageUrlsPromise = buildService().getImageUrls({
      document: { storageRelativePath: "org1/proj1/doc1.pdf", pdfPageCount: null },
      onPageCountUpdate,
      fileStorageService: buildFileStorageService(),
    })

    await expect(imageUrlsPromise).rejects.toBeInstanceOf(PdfPageLimitExceededError)
    await expect(imageUrlsPromise).rejects.toThrow(
      "This PDF has 25 pages; the maximum is 20 pages.",
    )
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(String(fetchSpy.mock.calls[0]![0])).toBe("http://pdf-converter.test/render-document")
    expect(onPageCountUpdate).not.toHaveBeenCalled()
  })

  it("throws a user-facing error without caching the count when the pdf has no pages", async () => {
    process.env.PDF_CONVERTER_URL = "http://pdf-converter.test"
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ pageCount: 0 }), { status: 200 }))
    const onPageCountUpdate = jest.fn()

    const imageUrlsPromise = buildService().getImageUrls({
      document: { storageRelativePath: "org1/proj1/doc1.pdf", pdfPageCount: null },
      onPageCountUpdate,
      fileStorageService: buildFileStorageService(),
    })

    await expect(imageUrlsPromise).rejects.toBeInstanceOf(PdfHasNoPagesError)
    await expect(imageUrlsPromise).rejects.toThrow("This PDF has no pages that can be rendered.")
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(String(fetchSpy.mock.calls[0]![0])).toBe("http://pdf-converter.test/render-document")
    expect(onPageCountUpdate).not.toHaveBeenCalled()
  })

  it("re-checks the converter instead of trusting a cached zero page count", async () => {
    process.env.PDF_CONVERTER_URL = "http://pdf-converter.test"
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ pageCount: 0 }), { status: 200 }))
    const onPageCountUpdate = jest.fn()

    const imageUrlsPromise = buildService().getImageUrls({
      document: { storageRelativePath: "org1/proj1/doc1.pdf", pdfPageCount: 0 },
      onPageCountUpdate,
      fileStorageService: buildFileStorageService(),
    })

    await expect(imageUrlsPromise).rejects.toBeInstanceOf(PdfHasNoPagesError)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(String(fetchSpy.mock.calls[0]![0])).toBe("http://pdf-converter.test/render-document")
    expect(onPageCountUpdate).not.toHaveBeenCalled()
  })

  it("rejects when the converter returns a 200 without a valid pageCount", async () => {
    process.env.PDF_CONVERTER_URL = "http://pdf-converter.test"
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ pages: 2 }), { status: 200 }))
    const onPageCountUpdate = jest.fn()

    await expect(
      buildService().getImageUrls({
        document: { storageRelativePath: "org1/proj1/doc1.pdf", pdfPageCount: null },
        onPageCountUpdate,
        fileStorageService: buildFileStorageService(),
      }),
    ).rejects.toThrow(
      "pdf-converter response from /render-document did not include a valid pageCount",
    )
    expect(onPageCountUpdate).not.toHaveBeenCalled()
  })

  it("rejects with a descriptive error when the converter returns a non-json 200", async () => {
    process.env.PDF_CONVERTER_URL = "http://pdf-converter.test"
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("<html>proxy error</html>", { status: 200 }))
    const onPageCountUpdate = jest.fn()

    await expect(
      buildService().getImageUrls({
        document: { storageRelativePath: "org1/proj1/doc1.pdf", pdfPageCount: null },
        onPageCountUpdate,
        fileStorageService: buildFileStorageService(),
      }),
    ).rejects.toThrow("pdf-converter returned a non-json response from /render-document")
    expect(onPageCountUpdate).not.toHaveBeenCalled()
  })

  it("reports a timeout when the request times out while reading the response body", async () => {
    process.env.PDF_CONVERTER_URL = "http://pdf-converter.test"
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new DOMException("The operation timed out", "TimeoutError")),
    } as unknown as Response)
    const onPageCountUpdate = jest.fn()

    await expect(
      buildService().getImageUrls({
        document: { storageRelativePath: "org1/proj1/doc1.pdf", pdfPageCount: null },
        onPageCountUpdate,
        fileStorageService: buildFileStorageService(),
      }),
    ).rejects.toThrow("pdf-converter request to /render-document timed out after 120000ms")
    expect(onPageCountUpdate).not.toHaveBeenCalled()
  })

  it("surfaces the converter's error message", async () => {
    process.env.PDF_CONVERTER_URL = "http://pdf-converter.test"
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ message: "invalid pdf: bad header" }), { status: 400 }),
      )
    const onPageCountUpdate = jest.fn()

    await expect(
      buildService().getImageUrls({
        document: { storageRelativePath: "org1/proj1/doc1.pdf", pdfPageCount: null },
        onPageCountUpdate,
        fileStorageService: buildFileStorageService(),
      }),
    ).rejects.toThrow("invalid pdf: bad header")
    expect(onPageCountUpdate).not.toHaveBeenCalled()
  })
})
