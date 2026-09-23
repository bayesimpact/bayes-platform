import { grantStatements, parseCliOptions } from "./analytics-readers"

describe("analytics-readers CLI helpers", () => {
  describe("parseCliOptions", () => {
    it("parses roles and the default timeout", () => {
      expect(parseCliOptions(["--role", "grafana_ro", "--role", "other_ro"])).toEqual({
        roles: ["grafana_ro", "other_ro"],
        statementTimeout: "30s",
      })
    })

    it("parses the statement timeout", () => {
      expect(parseCliOptions(["--role", "grafana_ro", "--statement-timeout", "2min"])).toEqual({
        roles: ["grafana_ro"],
        statementTimeout: "2min",
      })
    })

    it("requires a role", () => {
      expect(() => parseCliOptions([])).toThrow("At least one --role")
    })

    it("refuses anything but a plain identifier as a role name", () => {
      expect(() => parseCliOptions(["--role", 'x"; DROP ROLE admin; --'])).toThrow(
        "Not a role name",
      )
      expect(() => parseCliOptions(["--role", "Grafana"])).toThrow("Not a role name")
    })

    it("refuses a timeout without a unit", () => {
      expect(() => parseCliOptions(["--role", "grafana_ro", "--statement-timeout", "30"])).toThrow(
        "Not a statement timeout",
      )
    })

    it("refuses an unknown option", () => {
      expect(() => parseCliOptions(["--email", "x"])).toThrow("Unknown option")
    })
  })

  describe("grantStatements", () => {
    it("grants the membership and sets the timeout", () => {
      expect(grantStatements("grafana_ro", "30s")).toEqual({
        grant: 'GRANT analytics_reader TO "grafana_ro"',
        timeout: `ALTER ROLE "grafana_ro" SET statement_timeout = '30s'`,
      })
    })
  })
})
