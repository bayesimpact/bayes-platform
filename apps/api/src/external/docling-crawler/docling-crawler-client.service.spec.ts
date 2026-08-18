import dns from "node:dns"
import { Docling } from "docling-sdk"
import { chromium } from "playwright"
import { DOCLING_SERVE_URL_ENV } from "./docling-crawler.constants"
import { DoclingCrawlerClientService } from "./docling-crawler-client.service"

jest.mock("playwright", () => ({ chromium: { launch: jest.fn() } }))
jest.mock("docling-sdk", () => ({ Docling: jest.fn() }))
jest.mock("node:dns", () => ({ promises: { lookup: jest.fn() } }))

const PUBLIC_ADDRESS = "93.184.216.34"
const PRIVATE_ADDRESS = "10.0.0.5"

function serverAddrResponse(status: number, ipAddress: string = PUBLIC_ADDRESS) {
  return {
    status: () => status,
    serverAddr: () => Promise.resolve({ ipAddress, port: 443 }),
  }
}

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
    ;(dns.promises.lookup as jest.Mock).mockResolvedValue([{ address: PUBLIC_ADDRESS, family: 4 }])
  })

  afterEach(() => {
    if (originalDoclingServeUrl === undefined) {
      delete process.env[DOCLING_SERVE_URL_ENV]
    } else {
      process.env[DOCLING_SERVE_URL_ENV] = originalDoclingServeUrl
    }
  })

  it("crawls a single page and converts it via Docling", async () => {
    goto.mockResolvedValue(serverAddrResponse(200))
    convert.mockResolvedValue({ document: { md_content: "# Hello" } })

    const client = new DoclingCrawlerClientService()
    const onPage = jest.fn()
    const pages = await client.crawlUrl({ url: "https://example.com/", onPage })

    expect(pages).toEqual([{ url: "https://example.com/", markdown: "# Hello" }])
    expect(onPage).toHaveBeenCalledWith({ url: "https://example.com/", markdown: "# Hello" })
    expect(close).toHaveBeenCalled()
  })

  it("follows same-origin links discovered on the page", async () => {
    goto.mockResolvedValue(serverAddrResponse(200))
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
    goto.mockResolvedValue(serverAddrResponse(200))
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
    goto.mockResolvedValue(serverAddrResponse(404))

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

  it("aborts the crawl when the start URL resolves to a private address", async () => {
    ;(dns.promises.lookup as jest.Mock).mockResolvedValue([{ address: PRIVATE_ADDRESS, family: 4 }])

    const client = new DoclingCrawlerClientService()

    await expect(client.crawlUrl({ url: "https://example.com/" })).rejects.toThrow(
      /non-public address/,
    )
    expect(goto).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalled()
  })

  it("aborts the crawl when a discovered link resolves to a private address", async () => {
    goto.mockResolvedValue(serverAddrResponse(200))
    convert.mockResolvedValue({ document: { md_content: "content" } })
    evaluate.mockResolvedValueOnce(["https://example.com/about"]).mockResolvedValueOnce([])
    ;(dns.promises.lookup as jest.Mock)
      .mockResolvedValueOnce([{ address: PUBLIC_ADDRESS, family: 4 }])
      .mockResolvedValueOnce([{ address: PRIVATE_ADDRESS, family: 4 }])

    const client = new DoclingCrawlerClientService()

    await expect(client.crawlUrl({ url: "https://example.com/" })).rejects.toThrow(
      /non-public address/,
    )
    expect(goto).toHaveBeenCalledTimes(1)
    expect(close).toHaveBeenCalled()
  })

  it("aborts the crawl when the page actually connects to a private address", async () => {
    goto.mockResolvedValue(serverAddrResponse(200, PRIVATE_ADDRESS))

    const client = new DoclingCrawlerClientService()

    await expect(client.crawlUrl({ url: "https://example.com/" })).rejects.toThrow(
      /non-public address/,
    )
    expect(close).toHaveBeenCalled()
  })
})
