import { Docling } from "docling-sdk"
import { chromium } from "playwright"
import { DOCLING_SERVE_URL_ENV } from "./docling-crawler.constants"
import { DoclingCrawlerClientService } from "./docling-crawler-client.service"

jest.mock("playwright", () => ({ chromium: { launch: jest.fn() } }))
jest.mock("docling-sdk", () => ({ Docling: jest.fn() }))

describe("DoclingCrawlerClientService", () => {
  const originalDoclingServeUrl = process.env[DOCLING_SERVE_URL_ENV]

  let convert: jest.Mock
  let goto: jest.Mock
  let evaluate: jest.Mock
  let content: jest.Mock
  let pageUrl: jest.Mock
  let close: jest.Mock

  beforeEach(() => {
    process.env[DOCLING_SERVE_URL_ENV] = "http://localhost:5001"

    convert = jest.fn()
    ;(Docling as unknown as jest.Mock).mockImplementation(() => ({ convert }))

    goto = jest.fn()
    evaluate = jest.fn().mockResolvedValue([])
    content = jest.fn().mockResolvedValue("<html></html>")
    pageUrl = jest.fn().mockReturnValue("https://example.com/")
    close = jest.fn().mockResolvedValue(undefined)

    const page = {
      goto,
      evaluate,
      content,
      url: pageUrl,
    }
    const context = { newPage: jest.fn().mockResolvedValue(page) }
    const browser = { newContext: jest.fn().mockResolvedValue(context), close }
    ;(chromium.launch as jest.Mock).mockResolvedValue(browser)
  })

  afterEach(() => {
    if (originalDoclingServeUrl === undefined) {
      delete process.env[DOCLING_SERVE_URL_ENV]
    } else {
      process.env[DOCLING_SERVE_URL_ENV] = originalDoclingServeUrl
    }
  })

  it("crawls a single page and converts it via Docling", async () => {
    goto.mockResolvedValue({ status: () => 200 })
    convert.mockResolvedValue({ document: { md_content: "# Hello" } })

    const client = new DoclingCrawlerClientService()
    const onPage = jest.fn()
    const pages = await client.crawlUrl({ url: "https://example.com/", onPage })

    expect(pages).toEqual([{ url: "https://example.com/", markdown: "# Hello" }])
    expect(onPage).toHaveBeenCalledWith({ url: "https://example.com/", markdown: "# Hello" })
    expect(close).toHaveBeenCalled()
  })

  it("follows same-origin links discovered on the page", async () => {
    goto.mockResolvedValue({ status: () => 200 })
    convert.mockResolvedValue({ document: { md_content: "content" } })
    evaluate.mockResolvedValueOnce(["https://example.com/about"]).mockResolvedValueOnce([])

    const client = new DoclingCrawlerClientService()
    const pages = await client.crawlUrl({ url: "https://example.com/" })

    expect(pages.map((page) => page.url)).toEqual([
      "https://example.com/",
      "https://example.com/about",
    ])
    expect(goto).toHaveBeenCalledTimes(2)
  })

  it("only follows links under the start URL's path prefix", async () => {
    pageUrl.mockReturnValue("https://example.com/section")
    goto.mockResolvedValue({ status: () => 200 })
    convert.mockResolvedValue({ document: { md_content: "content" } })
    evaluate
      .mockResolvedValueOnce([
        "https://example.com/section/sub",
        "https://example.com/other",
        "https://example.com/section-other",
      ])
      .mockResolvedValueOnce([])

    const client = new DoclingCrawlerClientService()
    const pages = await client.crawlUrl({ url: "https://example.com/section" })

    expect(pages.map((page) => page.url)).toEqual([
      "https://example.com/section",
      "https://example.com/section/sub",
    ])
    expect(goto).toHaveBeenCalledTimes(2)
  })

  it("skips pages that return an HTTP error status", async () => {
    goto.mockResolvedValue({ status: () => 404 })

    const client = new DoclingCrawlerClientService()
    const pages = await client.crawlUrl({ url: "https://example.com/" })

    expect(pages).toEqual([])
    expect(convert).not.toHaveBeenCalled()
  })

  it("closes the browser even if a page fails with an error", async () => {
    goto.mockRejectedValue(new Error("boom"))

    const client = new DoclingCrawlerClientService()
    const pages = await client.crawlUrl({ url: "https://example.com/" })

    expect(pages).toEqual([])
    expect(close).toHaveBeenCalled()
  })

  it("throws when DOCLING_SERVE_URL is unset", async () => {
    delete process.env[DOCLING_SERVE_URL_ENV]

    const client = new DoclingCrawlerClientService()

    await expect(client.crawlUrl({ url: "https://example.com/" })).rejects.toThrow(
      DOCLING_SERVE_URL_ENV,
    )
  })
})
