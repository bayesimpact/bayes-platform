import { renderIndexHtml, serializeForInlineScript } from "./web-app-html"

const template = `<!doctype html>
<html>
  <head>
    <title>AgentStudio</title>
  </head>
  <body><div id="root"></div></body>
</html>`

describe("serializeForInlineScript", () => {
  it("keeps a script-closing tag inside a value inert", () => {
    const serialized = serializeForInlineScript({ appTitle: "</script><script>alert(1)" })
    expect(serialized).not.toContain("</script>")
    expect(JSON.parse(serialized)).toEqual({ appTitle: "</script><script>alert(1)" })
  })
})

describe("renderIndexHtml", () => {
  it("injects window.__CONFIG__ before </head>", () => {
    const html = renderIndexHtml(template, { apiUrl: "", auth0Domain: "tenant.auth0.com" })
    const headEnd = html.indexOf("</head>")
    const scriptIndex = html.indexOf(
      '<script>window.__CONFIG__={"apiUrl":"","auth0Domain":"tenant.auth0.com"}</script>',
    )
    expect(scriptIndex).toBeGreaterThan(-1)
    expect(scriptIndex).toBeLessThan(headEnd)
  })

  it("keeps the built title when the tenant sets none", () => {
    expect(renderIndexHtml(template, { apiUrl: "" })).toContain("<title>AgentStudio</title>")
  })

  it("replaces the title with an escaped tenant title", () => {
    const html = renderIndexHtml(template, { apiUrl: "", appTitle: "Acme <Health> & Co" })
    expect(html).toContain("<title>Acme &lt;Health&gt; &amp; Co</title>")
    expect(html).not.toContain("<title>AgentStudio</title>")
  })
})
