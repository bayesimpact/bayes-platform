import * as crypto from "node:crypto"
import { randomUUID } from "node:crypto"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { ConfigService } from "@nestjs/config"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { MulterFile } from "@/common/types"
import type { IFileStorage } from "./file-storage.interface"
import { GcsStorageService } from "./gcs-storage.service"
import { LocalStorageService, UploadTooLargeError } from "./local-storage.service"

// Helper to compute SHA-1 hash
const sha1 = (buffer: Buffer) => crypto.createHash("sha1").update(buffer).digest("hex")

if (process.env.GCS_STORAGE_BUCKET_NAME === "test-caseai-file-storage") {
  describe("StorageService", () => {
    let service: IFileStorage
    let configService: ConfigService
    let tempDir: string

    beforeEach(async () => {
      tempDir = path.join(
        os.tmpdir(),
        `dontsave_documents_test_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      )
      configService = new ConfigService()
      service = new GcsStorageService(configService)

      // @ts-expect-error
      service.dir = tempDir // override to use temp dir
      await fs.rm(tempDir, { recursive: true, force: true })
      await fs.mkdir(tempDir, { recursive: true })
    })

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true })
    })

    it("should save a file, return a correct temporary URL, and preserve file integrity (integration)", async () => {
      const buffer = Buffer.from("integration test content")
      const file = { buffer } as MulterFile
      const extension = "txt"
      const connectScope = { organizationId: "org1", projectId: "proj1" } as RequiredConnectScope
      const { storageRelativePath } = await service.save({
        extension,
        file,
        connectScope,
      })
      // Check URL
      const url = await service.getTemporaryUrl(storageRelativePath)
      expect(url).toBeDefined()
      const response = await fetch(url)
      expect(response.status).toBe(200)
      expect(response.ok).toBe(true)
      const arrayBuffer = await response.arrayBuffer()
      const fileBuffer = Buffer.from(arrayBuffer)
      // Now you can compare fileBuffer to your original buffer
      // Check file integrity
      expect(sha1(fileBuffer)).toBe(sha1(buffer))
    })
  })
} else {
  describe.skip("StorageService", () => {
    it("skips in CI", () => {})
  })
}

describe("LocalStorageService upload cap", () => {
  const service = new LocalStorageService(new ConfigService())

  it("rejects a body over the signed cap and still accepts a smaller retry", async () => {
    const storagePath = `upload-cap/${randomUUID()}.pdf`
    const uploadUrl = await service.generateSignedUploadUrl({
      storagePath,
      mimeType: "application/pdf",
      expiresInSeconds: 60,
      maxBytes: 4,
    })
    const token = new URL(uploadUrl).pathname.split("/").pop()
    if (!token) throw new Error("Upload URL is missing a token")

    await expect(service.fileExists(storagePath)).resolves.toBe(false)
    await expect(service.handleLocalUpload(token, Buffer.from("12345"))).rejects.toBeInstanceOf(
      UploadTooLargeError,
    )
    await service.handleLocalUpload(token, Buffer.from("1234"))

    await expect(service.fileExists(storagePath)).resolves.toBe(true)
    await expect(service.readFile(storagePath)).resolves.toEqual(Buffer.from("1234"))
    await service.deleteFile(storagePath)
  })
})
