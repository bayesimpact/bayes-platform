import { databaseSslOptions } from "./database-ssl"

describe("databaseSslOptions", () => {
  it("returns no ssl option when DATABASE_SSL is unset or disabled", () => {
    expect(databaseSslOptions({})).toEqual({})
    expect(databaseSslOptions({ DATABASE_SSL: "false" })).toEqual({})
    expect(databaseSslOptions({ DATABASE_SSL: "disable" })).toEqual({})
  })

  it("encrypts without verifying the certificate for require", () => {
    expect(databaseSslOptions({ DATABASE_SSL: "require" })).toEqual({
      ssl: { rejectUnauthorized: false },
    })
    expect(databaseSslOptions({ DATABASE_SSL: " Require " })).toEqual({
      ssl: { rejectUnauthorized: false },
    })
  })

  it("verifies against the given CA for verify-full", () => {
    expect(databaseSslOptions({ DATABASE_SSL: "verify-full", DATABASE_SSL_CA: "PEM" })).toEqual({
      ssl: { rejectUnauthorized: true, ca: "PEM" },
    })
  })

  it("refuses verify-full without a CA", () => {
    expect(() => databaseSslOptions({ DATABASE_SSL: "verify-full" })).toThrow("DATABASE_SSL_CA")
  })
})
