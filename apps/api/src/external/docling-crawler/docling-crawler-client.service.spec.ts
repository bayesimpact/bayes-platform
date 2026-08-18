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
  let newContext: jest.Mock
  let newPage: jest.Mock

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
    newPage = jest.fn().mockResolvedValue(page)
    const context = { newPage }
    newContext = jest.fn().mockResolvedValue(context)
    const browser = { newContext, close }
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

  it("skips a non-start page that returns an HTTP error status", async () => {
    goto
      .mockResolvedValueOnce(serverAddrResponse(200))
      .mockResolvedValueOnce(serverAddrResponse(404))
    convert.mockResolvedValue({ document: { md_content: "content" } })
    evaluate.mockResolvedValueOnce(["https://example.com/about"]).mockResolvedValueOnce([])

    const client = new DoclingCrawlerClientService()
    const pages = await client.crawlUrl({ url: "https://example.com/" })

    expect(pages).toEqual([{ url: "https://example.com/", markdown: "content" }])
    expect(convert).toHaveBeenCalledTimes(1)
  })

  it("rejects when the start URL returns an HTTP error status", async () => {
    goto.mockResolvedValue(serverAddrResponse(404))

    const client = new DoclingCrawlerClientService()

    await expect(client.crawlUrl({ url: "https://example.com/" })).rejects.toThrow(
      /Start URL failed to load/,
    )
    expect(convert).not.toHaveBeenCalled()
  })

  it("rejects when docling-serve is unreachable while converting the start page", async () => {
    goto.mockResolvedValue(serverAddrResponse(200))
    const connectionError = Object.assign(new Error("fetch failed"), {
      cause: { code: "ECONNREFUSED" },
    })
    convert.mockRejectedValue(connectionError)

    const client = new DoclingCrawlerClientService()

    await expect(client.crawlUrl({ url: "https://example.com/" })).rejects.toThrow(connectionError)
  })

  it("rejects via the zero-pages backstop when the start page has no links and fails to convert", async () => {
    goto.mockResolvedValue(serverAddrResponse(200))
    evaluate.mockResolvedValueOnce([])
    convert.mockRejectedValue(new Error("conversion failed"))

    const client = new DoclingCrawlerClientService()

    await expect(client.crawlUrl({ url: "https://example.com/" })).rejects.toThrow(
      /completed with 1 error\(s\) and no pages/,
    )
  })

  it("keeps crawling a discovered link even if the linking page fails to convert", async () => {
    goto.mockResolvedValue(serverAddrResponse(200))
    convert.mockRejectedValueOnce(new Error("conversion failed")).mockResolvedValueOnce({
      document: { md_content: "about content" },
    })
    evaluate.mockResolvedValueOnce(["https://example.com/about"]).mockResolvedValueOnce([])

    const client = new DoclingCrawlerClientService()
    const pages = await client.crawlUrl({ url: "https://example.com/" })

    expect(pages).toEqual([{ url: "https://example.com/about", markdown: "about content" }])
    expect(goto).toHaveBeenCalledTimes(2)
  })

  it("closes the browser and rejects when the start URL fails with an error", async () => {
    goto.mockRejectedValue(new Error("boom"))

    const client = new DoclingCrawlerClientService()

    await expect(client.crawlUrl({ url: "https://example.com/" })).rejects.toThrow("boom")
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

  it("stops crawling once the max crawl duration elapses", async () => {
    let now = 0
    const dateNowSpy = jest.spyOn(Date, "now").mockImplementation(() => now)

    goto.mockImplementationOnce(async () => {
      now = 1000
      return serverAddrResponse(200)
    })
    convert.mockResolvedValue({ document: { md_content: "content" } })
    evaluate.mockResolvedValueOnce(["https://example.com/about"]).mockResolvedValueOnce([])

    const client = new DoclingCrawlerClientService()
    const pages = await client.crawlUrl({
      url: "https://example.com/",
      maxCrawlDurationMs: 500,
    })

    expect(pages.map((page) => page.url)).toEqual(["https://example.com/"])
    expect(goto).toHaveBeenCalledTimes(1)

    dateNowSpy.mockRestore()
  })

  it("closes the browser when newContext() fails after launch", async () => {
    newContext.mockRejectedValue(new Error("context failed"))

    const client = new DoclingCrawlerClientService()

    await expect(client.crawlUrl({ url: "https://example.com/" })).rejects.toThrow("context failed")
    expect(close).toHaveBeenCalled()
  })

  it("closes the browser when newPage() fails after launch", async () => {
    newPage.mockRejectedValue(new Error("page failed"))

    const client = new DoclingCrawlerClientService()

    await expect(client.crawlUrl({ url: "https://example.com/" })).rejects.toThrow("page failed")
    expect(close).toHaveBeenCalled()
  })
})
