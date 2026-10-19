import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildPickerConfig,
  buildProfiles,
  frontendOrigins,
  nameOf,
  redirectUris,
  toYaml,
} from "./picker-config.mjs"

describe("toYaml", () => {
  it("writes nested objects, arrays of objects and scalars", () => {
    const yaml = toYaml({
      issuer: "http://localhost:5556",
      allowNonLocalIssuer: true,
      clients: [{ id: "web", redirectUris: ["http://a", "http://b"] }],
      empty: [],
    })
    assert.equal(
      yaml,
      [
        'issuer: "http://localhost:5556"',
        "allowNonLocalIssuer: true",
        "clients:",
        '  - id: "web"',
        "    redirectUris:",
        '      - "http://a"',
        '      - "http://b"',
        "empty: []",
      ].join("\n"),
    )
  })

  it("quotes strings, so special characters and quotes stay intact", () => {
    assert.equal(
      toYaml({ value: "a: b # c", name: 'Ana "A" Lee' }),
      'value: "a: b # c"\nname: "Ana \\"A\\" Lee"',
    )
  })
})

describe("nameOf", () => {
  it("keeps the stored name, so the first sign-in does not rename the account", () => {
    assert.equal(nameOf({ email: "ana@example.org", name: " Ana Lee " }), "Ana Lee")
  })

  it("falls back to the email", () => {
    assert.equal(nameOf({ email: "ana@example.org", name: null }), "ana@example.org")
    assert.equal(nameOf({ email: "ana@example.org", name: "  " }), "ana@example.org")
  })
})

describe("frontendOrigins", () => {
  it("splits FRONTEND_URL and adds https:// when an origin has no scheme, like the API's CORS", () => {
    assert.deepEqual(
      frontendOrigins(
        " https://connect.localhost:5273, connect.localhost:5274 ,,http://localhost:5173",
      ),
      ["https://connect.localhost:5273", "https://connect.localhost:5274", "http://localhost:5173"],
    )
  })

  it("falls back to the API's local origins when FRONTEND_URL is empty", () => {
    for (const frontendUrl of [undefined, "", " , "]) {
      assert.deepEqual(frontendOrigins(frontendUrl), [
        "https://connect.localhost:5173",
        "https://connect.localhost:5174",
      ])
    }
  })
})

describe("redirectUris", () => {
  it("drops the trailing slash and adds the base path, like getAppUrl", () => {
    assert.deepEqual(
      redirectUris({
        webOrigins: ["https://connect.localhost:5273/", "http://localhost:5173"],
        basePath: "/studio/",
      }).web,
      ["https://connect.localhost:5273/studio", "http://localhost:5173/studio"],
    )
  })
})

describe("buildPickerConfig", () => {
  it("lists the web app client once per redirect URI, with the profiles in their own file", () => {
    const config = buildPickerConfig({
      issuer: "http://localhost:5556",
      webRedirectUris: ["http://localhost:5173", "http://localhost:5173"],
    })
    assert.match(config, /^# Generated from the users of a local database/u)
    assert.equal(config.match(/"http:\/\/localhost:5173"/gu)?.length, 1)
    assert.match(config, /clients:\n {2}- id: "platform-web"/u)
    assert.match(config, /profilesFile: "profiles\.yaml"/u)
    assert.doesNotMatch(config, /allowNonLocalIssuer|actorHeader|keysFile/u)
  })

  it("writes the options of an environment on a domain, behind a gatekeeper", () => {
    const config = buildPickerConfig({
      issuer: "https://feature-x-auth.example.dev",
      webRedirectUris: ["https://feature-x.example.dev"],
      keysFile: "keys.json",
      allowNonLocalIssuer: true,
      actorHeader: "X-Auth-Request-Email",
    })
    assert.match(config, /allowNonLocalIssuer: true/u)
    assert.match(config, /actorHeader: "X-Auth-Request-Email"/u)
    assert.match(config, /keysFile: "keys\.json"/u)
  })
})

describe("buildProfiles", () => {
  it("gives every person their platform id as sub and their stored name", () => {
    const profiles = buildProfiles([
      { id: "6f1c0d36-0000-4000-8000-000000000001", email: "ana@example.org", name: "Ana" },
      { id: "6f1c0d36-0000-4000-8000-000000000002", email: "bo@example.org", name: null },
    ])
    assert.match(
      profiles,
      /profiles:\n {2}- sub: "6f1c0d36-0000-4000-8000-000000000001"\n {4}email: "ana@example\.org"\n {4}name: "Ana"/u,
    )
    assert.match(profiles, /name: "bo@example\.org"/u)
  })

  it("writes an empty list when the database has nobody", () => {
    assert.match(buildProfiles([]), /\nprofiles: \[\]\n$/u)
  })
})
