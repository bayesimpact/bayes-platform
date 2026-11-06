import { randomUUID } from "node:crypto"
import { Readable } from "node:stream"
import { ConfigService } from "@nestjs/config"
import {
  LOCAL_UPLOAD_MAX_BYTES,
  LocalStorageService,
  UploadSizeMismatchError,
  UploadTooLargeError,
} from "./local-storage.service"

describe("LocalStorageService signed upload size", () => {
  const service = new LocalStorageService(new ConfigService())

  it("rejects a body of another size and still accepts a retry with the signed size", async () => {
    const storagePath = `upload-cap/${randomUUID()}.pdf`
    const uploadUrl = await service.generateSignedUploadUrl({
      storagePath,
      mimeType: "application/pdf",
      expiresInSeconds: 60,
      contentLength: 4,
    })
    const token = new URL(uploadUrl).pathname.split("/").pop()
    if (!token) throw new Error("Upload URL is missing a token")

    await expect(service.fileExists(storagePath)).resolves.toBe(false)
    await expect(service.handleLocalUpload(token, Buffer.from("12345"))).rejects.toBeInstanceOf(
      UploadSizeMismatchError,
    )
    await expect(service.handleLocalUpload(token, Buffer.from("123"))).rejects.toBeInstanceOf(
      UploadSizeMismatchError,
    )
    await service.handleLocalUpload(token, Buffer.from("1234"))

    await expect(service.fileExists(storagePath)).resolves.toBe(true)
    await expect(service.readFile(storagePath)).resolves.toEqual(Buffer.from("1234"))
    await service.deleteFile(storagePath)
  })
})

describe("LocalStorageService.readUploadBody", () => {
  const service = new LocalStorageService(new ConfigService())
  const megabyte = Buffer.alloc(1024 * 1024)

  const signUpload = async (contentLength: number) => {
    const uploadUrl = await service.generateSignedUploadUrl({
      storagePath: `upload-cap/${randomUUID()}.pdf`,
      mimeType: "application/pdf",
      expiresInSeconds: 60,
      contentLength,
    })
    const token = new URL(uploadUrl).pathname.split("/").pop()
    if (!token) throw new Error("Upload URL is missing a token")
    return token
  }

  /** A body of `chunkCount` one-megabyte chunks that counts how many were read. */
  const countingBody = (chunkCount: number) => {
    const counter = { readChunks: 0 }
    const body = Readable.from(
      (function* () {
        for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
          counter.readChunks++
          yield megabyte
        }
      })(),
    )
    return { body, counter }
  }

  it("returns a body of the signed size", async () => {
    const token = await signUpload(4)

    await expect(
      service.readUploadBody(token, Readable.from([Buffer.from("1234")])),
    ).resolves.toEqual(Buffer.from("1234"))
  })

  it("stops reading once the body passes the signed size", async () => {
    const token = await signUpload(2 * megabyte.length)
    const { body, counter } = countingBody(100)

    await expect(service.readUploadBody(token, body)).rejects.toBeInstanceOf(
      UploadSizeMismatchError,
    )
    expect(counter.readChunks).toBeLessThan(100)
  })

  it("stops reading once the body passes the hard maximum, whatever size was signed", async () => {
    const token = await signUpload(LOCAL_UPLOAD_MAX_BYTES * 4)
    const chunkCount = (LOCAL_UPLOAD_MAX_BYTES * 4) / megabyte.length
    const { body, counter } = countingBody(chunkCount)

    await expect(service.readUploadBody(token, body)).rejects.toBeInstanceOf(UploadTooLargeError)
    expect(counter.readChunks).toBeLessThan(chunkCount)
  })

  it("rejects an unknown token without reading the body", async () => {
    const { body, counter } = countingBody(1)

    await expect(service.readUploadBody(randomUUID(), body)).rejects.toThrow(
      "Upload token not found or already used.",
    )
    expect(counter.readChunks).toBe(0)
  })
})
