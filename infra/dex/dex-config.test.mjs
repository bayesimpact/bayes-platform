import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  BULL_BOARD_CLIENT_SECRET,
  buildDexConfig,
  redirectUris,
  toYaml,
  usernameOf,
} from "./dex-config.mjs"

describe("toYaml", () => {
  it("writes nested objects, arrays of objects and scalars", () => {
    const yaml = toYaml({
      issuer: "http://localhost:5556/dex",
      web: { http: "0.0.0.0:5556", allowedOrigins: ["*"] },
      enablePasswordDB: true,
      staticClients: [{ id: "web", public: true, redirectURIs: ["http://a", "http://b"] }],
      empty: [],
    })
    assert.equal(
      yaml,
      [
        'issuer: "http://localhost:5556/dex"',
        "web:",
        '  http: "0.0.0.0:5556"',
        "  allowedOrigins:",
        '    - "*"',
        "enablePasswordDB: true",
        "staticClients:",
        '  - id: "web"',
        "    public: true",
        "    redirectURIs:",
        '      - "http://a"',
        '      - "http://b"',
        "empty: []",
      ].join("\n"),
    )
  })

  it("quotes strings, so bcrypt hashes and quotes stay intact", () => {
    assert.equal(
      toYaml({ hash: "$2a$10$abc/def", name: 'Ana "A" Lee' }),
      'hash: "$2a$10$abc/def"\nname: "Ana \\"A\\" Lee"',
    )
  })
})

describe("usernameOf", () => {
  it("keeps the stored name, so the first sign-in does not rename the account", () => {
    assert.equal(usernameOf({ email: "ana@example.org", name: " Ana Lee " }), "Ana Lee")
  })

  it("falls back to the email", () => {
    assert.equal(usernameOf({ email: "ana@example.org", name: null }), "ana@example.org")
    assert.equal(usernameOf({ email: "ana@example.org", name: "  " }), "ana@example.org")
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

  it("builds the Bull Board callback from its base URL and route", () => {
    assert.deepEqual(
      redirectUris({
        webOrigins: [],
        bullBoardBaseUrl: "https://connect.localhost:3100/",
        bullBoardRoute: "/ops/queues/",
      }).bullBoard,
      ["https://connect.localhost:3100/api/ops/queues/oauth/callback"],
    )
    assert.deepEqual(
      redirectUris({ webOrigins: [], bullBoardBaseUrl: "http://x.connect.localhost:8800" })
        .bullBoard,
      ["http://x.connect.localhost:8800/api/internal/bull-board/oauth/callback"],
    )
  })

  it("has no Bull Board callback without a base URL", () => {
    assert.deepEqual(redirectUris({ webOrigins: [] }).bullBoard, [])
  })
})

describe("buildDexConfig", () => {
  const config = buildDexConfig({
    issuer: "http://localhost:5556/dex",
    listenAddress: "0.0.0.0:5556",
    webRedirectUris: ["http://localhost:5173", "http://localhost:5173"],
    bullBoardRedirectUris: ["http://localhost:3000/api/internal/bull-board/oauth/callback"],
    users: [
      { id: "6f1c0d36-0000-4000-8000-000000000001", email: "ana@example.org", name: "Ana" },
      { id: "6f1c0d36-0000-4000-8000-000000000002", email: "bo@example.org", name: null },
    ],
    passwordHash: "$2a$10$hash",
  })

  it("starts with a header saying the file is generated", () => {
    assert.match(config, /^# Generated from the users of a local database/u)
  })

  it("gives every user the shared hash and their platform id as userID", () => {
    assert.match(
      config,
      / {2}- email: "ana@example\.org"\n {4}hash: "\$2a\$10\$hash"\n {4}username: "Ana"\n {4}userID: "6f1c0d36-0000-4000-8000-000000000001"/u,
    )
    assert.match(config, /username: "bo@example\.org"/u)
  })

  it("lists each redirect URI once and the Bull Board client secret", () => {
    assert.equal(config.match(/"http:\/\/localhost:5173"/gu)?.length, 1)
    assert.match(config, new RegExp(`secret: "${BULL_BOARD_CLIENT_SECRET}"`, "u"))
  })
})
