import dns, { type LookupAddress } from "node:dns"
import {
  ALLOW_PRIVATE_MODEL_ENDPOINTS_ENV,
  assertModelEndpointRequestHost,
  assertSafeModelEndpointUrl,
  InvalidModelEndpointUrlError,
  isPrivateAddress,
  modelEndpointLookup,
} from "./model-endpoint-url"

const resolveTo =
  (...addresses: string[]) =>
  async () =>
    addresses

describe("assertSafeModelEndpointUrl", () => {
  it("accepts an https URL whose host resolves to public addresses", async () => {
    await expect(
      assertSafeModelEndpointUrl("https://vllm.example.org/base/", {
        allowPrivate: false,
        resolveHost: resolveTo("203.0.113.10", "2001:db8::1"),
      }),
    ).resolves.toBe("https://vllm.example.org/base/")
  })

  it.each([
    ["not a url", "not valid"],
    ["http://vllm.example.org/", "https"],
    ["ftp://vllm.example.org/", "https"],
    ["https://user:secret@vllm.example.org/", "credentials"],
  ])("refuses %s", async (url, message) => {
    await expect(
      assertSafeModelEndpointUrl(url, {
        allowPrivate: false,
        resolveHost: resolveTo("203.0.113.10"),
      }),
    ).rejects.toThrow(message)
  })

  it("refuses a host that resolves to one private address among public ones", async () => {
    await expect(
      assertSafeModelEndpointUrl("https://vllm.example.org/", {
        allowPrivate: false,
        resolveHost: resolveTo("203.0.113.10", "10.1.2.3"),
      }),
    ).rejects.toBeInstanceOf(InvalidModelEndpointUrlError)
  })

  it("refuses a host that does not resolve", async () => {
    await expect(
      assertSafeModelEndpointUrl("https://nowhere.example.org/", {
        allowPrivate: false,
        resolveHost: async () => {
          throw new Error("ENOTFOUND")
        },
      }),
    ).rejects.toThrow("cannot be resolved")
  })

  it.each([
    "https://[::ffff:127.0.0.1]/",
    "https://[::127.0.0.1]/",
    "https://[64:ff9b::169.254.169.254]/",
    "https://[2002:a9fe:a9fe::]/",
    "https://[fec0::1]/",
    "https://2130706433/",
  ])("refuses the private address of %s", async (url) => {
    await expect(assertSafeModelEndpointUrl(url, { allowPrivate: false })).rejects.toThrow(
      "not a public address",
    )
  })

  it("accepts http and private hosts when private servers are allowed", async () => {
    await expect(
      assertSafeModelEndpointUrl("http://localhost:8000/", {
        allowPrivate: true,
        resolveHost: resolveTo("127.0.0.1"),
      }),
    ).resolves.toBe("http://localhost:8000/")
  })
})

describe("isPrivateAddress", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.20.1.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "::",
    "fd00::1",
    "fe80::1",
    "::ffff:10.0.0.1",
    "::ffff:7f00:1",
    "::ffff:a9fe:a9fe",
    "::127.0.0.1",
    "::a9fe:a9fe",
    "64:ff9b::a9fe:a9fe",
    "64:ff9b:1::a00:1",
    "2002:7f00:1::",
    "2002:a9fe:a9fe::1",
    "2001:0:4136:e378:8000:63bf:3fff:fdd2",
    "fec0::1",
    "ff02::1",
    "fe80::1%eth0",
    "192.0.0.170",
    "192.88.99.1",
    "198.18.0.1",
    "224.0.0.1",
    "255.255.255.255",
    "not-an-ip",
  ])("treats %s as private", (address) => {
    expect(isPrivateAddress(address)).toBe(true)
  })

  it.each([
    "203.0.113.10",
    "8.8.8.8",
    "2001:db8::1",
    "::ffff:8.8.8.8",
    "2606:4700:4700::1111",
    "2002:808:808::1",
  ])("treats %s as public", (address) => {
    expect(isPrivateAddress(address)).toBe(false)
  })
})

describe("assertModelEndpointRequestHost", () => {
  it("refuses a request to a private address", () => {
    expect(() =>
      assertModelEndpointRequestHost("https://[::ffff:a9fe:a9fe]/v1/chat/completions", {
        allowPrivate: false,
      }),
    ).toThrow(InvalidModelEndpointUrlError)
  })

  it("leaves a name to the lookup of the connection", () => {
    expect(() =>
      assertModelEndpointRequestHost("https://vllm.example.org/v1/chat/completions", {
        allowPrivate: false,
      }),
    ).not.toThrow()
  })

  it("accepts a private address when private servers are allowed", () => {
    expect(() =>
      assertModelEndpointRequestHost("http://127.0.0.1:8000/v1", { allowPrivate: true }),
    ).not.toThrow()
  })
})

describe("modelEndpointLookup", () => {
  const savedAllowPrivate = process.env[ALLOW_PRIVATE_MODEL_ENDPOINTS_ENV]

  const answerWith = (...addresses: LookupAddress[]) =>
    jest
      .spyOn(dns, "lookup")
      .mockImplementation(((
        _hostname: string,
        _options: unknown,
        callback: (error: Error | null, addresses: LookupAddress[]) => void,
      ) => callback(null, addresses)) as unknown as typeof dns.lookup)

  const lookUp = (options: { all?: boolean }) =>
    new Promise<{ error: Error | null; address: unknown; family?: number }>((resolve) =>
      modelEndpointLookup(
        "vllm.example.org",
        options as dns.LookupAllOptions,
        (error, address, family?: number) => resolve({ error, address, family }),
      ),
    )

  beforeEach(() => {
    delete process.env[ALLOW_PRIVATE_MODEL_ENDPOINTS_ENV]
  })

  afterEach(() => {
    jest.restoreAllMocks()
    if (savedAllowPrivate === undefined) delete process.env[ALLOW_PRIVATE_MODEL_ENDPOINTS_ENV]
    else process.env[ALLOW_PRIVATE_MODEL_ENDPOINTS_ENV] = savedAllowPrivate
  })

  it("hands the connection the public addresses it checked", async () => {
    const addresses = [
      { address: "8.8.8.8", family: 4 },
      { address: "2606:4700:4700::1111", family: 6 },
    ]
    answerWith(...addresses)

    expect(await lookUp({ all: true })).toEqual({
      error: null,
      address: addresses,
      family: undefined,
    })
    expect(await lookUp({})).toEqual({ error: null, address: "8.8.8.8", family: 4 })
  })

  it("refuses a name that now resolves to a private address", async () => {
    answerWith({ address: "8.8.8.8", family: 4 }, { address: "169.254.169.254", family: 4 })

    const { error } = await lookUp({ all: true })
    expect(error).toBeInstanceOf(InvalidModelEndpointUrlError)
  })

  it("lets a private address through when private servers are allowed", async () => {
    process.env[ALLOW_PRIVATE_MODEL_ENDPOINTS_ENV] = "true"
    answerWith({ address: "127.0.0.1", family: 4 })

    expect(await lookUp({})).toEqual({ error: null, address: "127.0.0.1", family: 4 })
  })
})
