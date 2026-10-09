import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { readEnvValues, setEnvValues } from "./env-file.mjs"

describe("readEnvValues", () => {
  it("reads quoted and unquoted values, without inline comments", () => {
    assert.deepEqual(
      readEnvValues(
        [
          "# a comment",
          "PLAIN=value # trailing comment",
          'DOUBLE="with # hash"',
          "SINGLE='single'",
          "export EXPORTED=yes",
          "EMPTY=",
        ].join("\n"),
      ),
      {
        PLAIN: "value",
        DOUBLE: "with # hash",
        SINGLE: "single",
        EXPORTED: "yes",
        EMPTY: "",
      },
    )
  })

  it("keeps the last assignment, like dotenv", () => {
    assert.deepEqual(readEnvValues("KEY=first\nKEY=second\n"), { KEY: "second" })
  })
})

describe("setEnvValues", () => {
  it("rewrites every assignment of a key and keeps the other lines", () => {
    const before = "# Auth\nOIDC_ISSUER_URL=https://old/\nOTHER=1\nexport OIDC_ISSUER_URL=x\n"
    assert.equal(
      setEnvValues(before, { OIDC_ISSUER_URL: "http://localhost:5556/dex" }),
      "# Auth\nOIDC_ISSUER_URL=http://localhost:5556/dex\nOTHER=1\nOIDC_ISSUER_URL=http://localhost:5556/dex\n",
    )
  })

  it("appends the missing keys under a comment", () => {
    assert.equal(
      setEnvValues("OTHER=1\n", { A: "a", B: "" }, { comment: "Local Dex" }),
      "OTHER=1\n\n# Local Dex\nA=a\nB=\n",
    )
  })

  it("does not append the keys that must already exist", () => {
    assert.equal(
      setEnvValues(
        "WEB_OIDC_AUDIENCE=api\n",
        { WEB_OIDC_AUDIENCE: "", WEB_OIDC_AUTHORITY: "" },
        {
          onlyExisting: ["WEB_OIDC_AUDIENCE", "WEB_OIDC_AUTHORITY"],
        },
      ),
      "WEB_OIDC_AUDIENCE=\n",
    )
  })

  it("leaves commented-out keys alone", () => {
    assert.equal(setEnvValues("# A=old\n", { A: "new" }), "# A=old\n\nA=new\n")
  })

  it("creates a file from nothing", () => {
    assert.equal(setEnvValues("", { A: "a" }, { comment: "Local Dex" }), "# Local Dex\nA=a\n")
  })

  it("returns the same text when nothing changes", () => {
    const text = "A=a\nB=b\n"
    assert.equal(setEnvValues(text, { A: "a" }), text)
  })
})
