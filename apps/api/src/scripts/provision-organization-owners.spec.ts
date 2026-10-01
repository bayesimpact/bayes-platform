import {
  parseCliOptions,
  parseOwnersCsv,
  runProvisioningBatch,
} from "./provision-organization-owners"

describe("provision-organization-owners CLI helpers", () => {
  describe("parseCliOptions", () => {
    it("should parse file and dry-run flags", () => {
      const options = parseCliOptions(["--file", "owners.csv", "--dry-run"])
      expect(options).toEqual({ csvFilePath: "owners.csv", dryRun: true })
    })

    it("should throw when file is missing", () => {
      expect(() => parseCliOptions(["--dry-run"])).toThrow(
        "Missing required argument: --file <path-to-csv>",
      )
    })
  })

  describe("parseOwnersCsv", () => {
    it("should parse rows with required headers", () => {
      const csv = "email,organizationName,fullName\nuser@example.com,Demo Org,Demo User"
      const rows = parseOwnersCsv(csv)

      expect(rows).toEqual([
        {
          email: "user@example.com",
          organizationName: "Demo Org",
          fullName: "Demo User",
        },
      ])
    })

    it("should parse rows without fullName", () => {
      const csv = "email,organizationName\nuser@example.com,Demo Org"
      const rows = parseOwnersCsv(csv)

      expect(rows).toEqual([
        {
          email: "user@example.com",
          organizationName: "Demo Org",
        },
      ])
    })

    it("should handle quoted values with commas", () => {
      const csv = 'email,organizationName\nuser@example.com,"Org, Inc."'
      const rows = parseOwnersCsv(csv)

      expect(rows).toEqual([
        {
          email: "user@example.com",
          organizationName: "Org, Inc.",
        },
      ])
    })
  })

  describe("runProvisioningBatch", () => {
    it("should call provisionWorkspaceOwner in normal mode", async () => {
      const provisioningService = {
        previewProvisioning: jest.fn(),
        provisionWorkspaceOwner: jest.fn().mockResolvedValue({
          status: "granted",
          email: "user@example.com",
          organizationName: "Demo Org",
          organizationId: "org-1",
          projectId: "proj-1",
          userId: "user-1",
          message: "Access granted.",
        }),
      }

      const results = await runProvisioningBatch({
        rows: [{ email: "user@example.com", organizationName: "Demo Org" }],
        dryRun: false,
        provisioningService: provisioningService as never,
      })

      expect(provisioningService.provisionWorkspaceOwner).toHaveBeenCalledTimes(1)
      expect(provisioningService.provisionWorkspaceOwner).toHaveBeenCalledWith({
        email: "user@example.com",
        organizationName: "Demo Org",
        fullName: undefined,
      })
      expect(results[0]?.status).toBe("granted")
    })

    it("should call previewProvisioning in dry-run mode", async () => {
      const provisioningService = {
        previewProvisioning: jest.fn().mockResolvedValue({
          status: "would_grant",
          email: "user@example.com",
          organizationName: "Demo Org",
        }),
        provisionWorkspaceOwner: jest.fn(),
      }

      const results = await runProvisioningBatch({
        rows: [{ email: "user@example.com", organizationName: "Demo Org" }],
        dryRun: true,
        provisioningService: provisioningService as never,
      })

      expect(provisioningService.previewProvisioning).toHaveBeenCalledTimes(1)
      expect(provisioningService.provisionWorkspaceOwner).not.toHaveBeenCalled()
      expect(results[0]?.status).toBe("would_grant")
    })

    it("should catch errors and report them as failed", async () => {
      const provisioningService = {
        previewProvisioning: jest.fn(),
        provisionWorkspaceOwner: jest.fn().mockRejectedValue(new Error("Database failure")),
      }

      const results = await runProvisioningBatch({
        rows: [{ email: "user@example.com", organizationName: "Demo Org" }],
        dryRun: false,
        provisioningService: provisioningService as never,
      })

      expect(results[0]?.status).toBe("failed")
      expect(results[0]).toHaveProperty("message", "Database failure")
    })
  })
})
