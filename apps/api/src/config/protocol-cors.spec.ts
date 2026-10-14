import type { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface"
import { buildCorsOptionsDelegate } from "./cors"
import { withOpenProtocolCors } from "./protocol-cors"

describe("withOpenProtocolCors", () => {
  const frontendUrls = ["https://app.example.org"]
  const delegate = withOpenProtocolCors(buildCorsOptionsDelegate(frontendUrls))

  const optionsFor = (url: string | undefined): CorsOptions => {
    let received: CorsOptions | undefined
    delegate({ url }, (error, options) => {
      expect(error).toBeNull()
      received = options as CorsOptions
    })
    if (!received) throw new Error("delegate did not call back synchronously")
    return received
  }

  it("reflects the origin on the OAuth and MCP protocol endpoints", () => {
    expect(optionsFor("/api/oauth/token").origin).toBe(true)
    expect(optionsFor("/api/oauth/register").origin).toBe(true)
    expect(optionsFor("/api/mcp").origin).toBe(true)
    expect(optionsFor("/.well-known/oauth-authorization-server/api/oauth").origin).toBe(true)
  })

  it("keeps the consent page endpoints to the frontend URLs", () => {
    expect(optionsFor("/api/oauth/consent?client_id=x").origin).toEqual(frontendUrls)
    expect(optionsFor("/api/oauth/grants").origin).toEqual(frontendUrls)
  })

  it("leaves the public API and everything else to the existing policy", () => {
    expect(optionsFor("/public/agents/token123/config").origin).toBe(true)
    expect(optionsFor("/organizations/1/projects").origin).toEqual(frontendUrls)
    expect(optionsFor(undefined).origin).toEqual(frontendUrls)
  })

  it("never enables credentialed CORS", () => {
    expect(optionsFor("/api/mcp").credentials).toBeUndefined()
  })
})
