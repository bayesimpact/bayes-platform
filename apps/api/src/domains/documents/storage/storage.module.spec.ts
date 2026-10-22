import type { ConfigService } from "@nestjs/config"
import { resolveStorageBackend } from "./storage.module"

const configWith = (settings: Record<string, string>) =>
  ({ get: (key: string) => settings[key] }) as unknown as ConfigService

describe("resolveStorageBackend", () => {
  it("uses STORAGE_BACKEND when it is set", () => {
    expect(resolveStorageBackend(configWith({ STORAGE_BACKEND: "s3" }))).toBe("s3")
    expect(
      resolveStorageBackend(
        configWith({ STORAGE_BACKEND: "local", GCS_STORAGE_BUCKET_NAME: "a-bucket" }),
      ),
    ).toBe("local")
  })

  it("falls back to gcs when a GCS bucket is configured, local otherwise", () => {
    expect(resolveStorageBackend(configWith({ GCS_STORAGE_BUCKET_NAME: "a-bucket" }))).toBe("gcs")
    expect(resolveStorageBackend(configWith({}))).toBe("local")
  })

  it("rejects an unknown backend", () => {
    expect(() => resolveStorageBackend(configWith({ STORAGE_BACKEND: "minio" }))).toThrow(
      "Invalid STORAGE_BACKEND: minio. Use s3, gcs or local.",
    )
  })
})
