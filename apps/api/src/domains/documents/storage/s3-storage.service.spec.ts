import { randomUUID } from "node:crypto"
import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3"
import type { ConfigService } from "@nestjs/config"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { MulterFile } from "@/common/types"
import { S3StorageService } from "./s3-storage.service"

// Runs against a real S3-compatible store: SeaweedFS from infra/database (profile `storage`)
// in the CI and on a laptop. Without S3_TEST_ENDPOINT the suite is skipped.
const endpoint = process.env.S3_TEST_ENDPOINT
const accessKeyId = process.env.S3_TEST_ACCESS_KEY_ID ?? "local-dev-access-key"
const secretAccessKey = process.env.S3_TEST_SECRET_ACCESS_KEY ?? "local-dev-secret-key"

const describeWithS3 = endpoint ? describe : describe.skip

describeWithS3("S3StorageService (integration)", () => {
  const bucket = `test-${randomUUID()}`
  const settings: Record<string, string | undefined> = {
    S3_ENDPOINT: endpoint,
    S3_BUCKET: bucket,
    S3_ACCESS_KEY_ID: accessKeyId,
    S3_SECRET_ACCESS_KEY: secretAccessKey,
    S3_FORCE_PATH_STYLE: "true",
  }
  const configService = { get: (key: string) => settings[key] } as unknown as ConfigService
  const connectScope = { organizationId: "org1", projectId: "proj1" } as RequiredConnectScope
  let service: S3StorageService

  beforeAll(async () => {
    const admin = new S3Client({
      endpoint,
      region: "us-east-1",
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    })
    await admin.send(new CreateBucketCommand({ Bucket: bucket }))
    service = new S3StorageService(configService)
  })

  it("saves, reads, streams and deletes a file", async () => {
    const buffer = Buffer.from("integration test content")
    const { storageRelativePath } = await service.save({
      extension: "txt",
      file: { buffer, mimetype: "text/plain" } as MulterFile,
      connectScope,
    })

    await expect(service.fileExists(storageRelativePath)).resolves.toBe(true)
    await expect(service.readFile(storageRelativePath)).resolves.toEqual(buffer)

    const chunks: Buffer[] = []
    for await (const chunk of service.createReadStream(storageRelativePath)) {
      chunks.push(chunk as Buffer)
    }
    expect(Buffer.concat(chunks)).toEqual(buffer)

    const downloaded = await fetch(await service.getTemporaryUrl(storageRelativePath))
    expect(downloaded.status).toBe(200)
    expect(Buffer.from(await downloaded.arrayBuffer())).toEqual(buffer)

    await service.deleteFile(storageRelativePath)
    await expect(service.fileExists(storageRelativePath)).resolves.toBe(false)
    await expect(service.deleteFile(storageRelativePath)).resolves.toBeUndefined()
  })

  it("destroys the read stream when the object is missing", async () => {
    const stream = service.createReadStream(`missing/${randomUUID()}.txt`)
    await expect(stream.toArray()).rejects.toThrow()
  })

  it("accepts an upload of the signed size and type only", async () => {
    const body = Buffer.from("%PDF-1.4")
    const storagePath = `uploads/${randomUUID()}.pdf`
    const uploadUrl = await service.generateSignedUploadUrl({
      storagePath,
      mimeType: "application/pdf",
      expiresInSeconds: 60,
      contentLength: body.length,
    })
    const put = (headers: Record<string, string>, payload: Buffer) =>
      fetch(uploadUrl, { method: "PUT", headers, body: new Uint8Array(payload) })

    const tooLong = await put(
      { "Content-Type": "application/pdf" },
      Buffer.from("%PDF-1.4 and more"),
    )
    expect(tooLong.status).toBe(403)
    const wrongType = await put({ "Content-Type": "text/plain" }, body)
    expect(wrongType.status).toBe(403)
    await expect(service.fileExists(storagePath)).resolves.toBe(false)

    const uploaded = await put({ "Content-Type": "application/pdf" }, body)
    expect(uploaded.status).toBe(200)
    await expect(service.readFile(storagePath)).resolves.toEqual(body)
  })
})

describe("S3StorageService on a store that answers 404 to a delete of a missing key", () => {
  // The S3 API of GCS answers 404 (NoSuchKey) where S3 answers 204.
  const notFound = Object.assign(new Error("The specified key does not exist."), {
    name: "NoSuchKey",
    $metadata: { httpStatusCode: 404 },
  })
  const configService = {
    get: (key: string) => (key === "S3_BUCKET" ? "documents" : undefined),
  } as unknown as ConfigService
  const serviceWithSend = (send: jest.Mock) => {
    const service = new S3StorageService(configService)
    ;(service as unknown as { client: { send: jest.Mock } }).client.send = send
    return service
  }

  it("treats the delete of a missing key as done", async () => {
    const service = serviceWithSend(jest.fn().mockRejectedValue(notFound))
    await expect(service.deleteFile("org1/proj1/missing.pdf")).resolves.toBeUndefined()
  })

  it("still fails on another error", async () => {
    const denied = Object.assign(new Error("Access denied"), { $metadata: { httpStatusCode: 403 } })
    const service = serviceWithSend(jest.fn().mockRejectedValue(denied))
    await expect(service.deleteFile("org1/proj1/file.pdf")).rejects.toThrow("Access denied")
  })
})
