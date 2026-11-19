import { describe, expect, it } from "vitest"
import { resolveSandboxOrigin, sandboxLabelOf } from "./sandbox-origin"

const HOST_ORIGIN = "https://platform.example.org"

describe("sandboxLabelOf", () => {
  it("gives a DNS label: the 32 first hexadecimal characters of the key's SHA-256", async () => {
    // printf abc | shasum -a 256
    expect(await sandboxLabelOf("abc")).toBe("ba7816bf8f01cfea414140de5dae2223")
  })

  it("gives two keys two labels", async () => {
    expect(await sandboxLabelOf("server-1")).not.toBe(await sandboxLabelOf("server-2"))
  })
})

describe("resolveSandboxOrigin", () => {
  it("gives no origin when the install configures none", async () => {
    expect(await resolveSandboxOrigin(undefined, HOST_ORIGIN)).toBeUndefined()
    expect(await resolveSandboxOrigin({ template: "  ", key: "abc" }, HOST_ORIGIN)).toBeUndefined()
  })

  it("puts the label of the app's key in the template", async () => {
    const origin = await resolveSandboxOrigin(
      { template: "https://{label}.staging.usercontent.example", key: "abc" },
      HOST_ORIGIN,
    )

    expect(origin).toBe("https://ba7816bf8f01cfea414140de5dae2223.staging.usercontent.example")
  })

  it("gives no origin when the template needs a key the app does not have", async () => {
    const origin = await resolveSandboxOrigin(
      { template: "https://{label}.usercontent.example" },
      HOST_ORIGIN,
    )

    expect(origin).toBeUndefined()
  })

  it("takes a template without a label as one origin for every app", async () => {
    const origin = await resolveSandboxOrigin(
      { template: "http://sandbox.localhost:8800" },
      HOST_ORIGIN,
    )

    expect(origin).toBe("http://sandbox.localhost:8800")
  })

  it("refuses the host's own origin", async () => {
    await expect(resolveSandboxOrigin({ template: HOST_ORIGIN }, HOST_ORIGIN)).rejects.toThrow(
      "must not be its host's own origin",
    )
  })

  it.each([
    "sandbox.example.org",
    "https://sandbox.example.org/",
    "https://sandbox.example.org/path",
    "javascript://sandbox.example.org",
  ])("refuses %s, which is not a plain http(s) origin", async (template) => {
    await expect(resolveSandboxOrigin({ template }, HOST_ORIGIN)).rejects.toThrow()
  })
})
