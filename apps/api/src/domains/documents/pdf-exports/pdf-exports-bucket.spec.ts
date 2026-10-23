import { randomUUID } from "node:crypto"
import { CreateBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { S3PdfExportsBucket } from "./pdf-exports-bucket"

// Runs against a real S3-compatible store: SeaweedFS from infra/database (profile `storage`)
// in the CI and on a laptop. Without S3_TEST_ENDPOINT the suite is skipped.
const endpoint = process.env.S3_TEST_ENDPOINT
const describeWithS3 = endpoint ? describe : describe.skip

describeWithS3("S3PdfExportsBucket (integration)", () => {
  const bucketName = `test-${randomUUID()}`
  const client = new S3Client({
    endpoint,
    region: "us-east-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_TEST_ACCESS_KEY_ID ?? "local-dev-access-key",
      secretAccessKey: process.env.S3_TEST_SECRET_ACCESS_KEY ?? "local-dev-secret-key",
    },
  })
  const bucket = new S3PdfExportsBucket(client, bucketName)

  beforeAll(async () => {
    await client.send(new CreateBucketCommand({ Bucket: bucketName }))
    for (const name of ["tmp/pdf-exports/1-a/a.pdf", "tmp/pdf-exports/2-b/b.pdf", "other/c.pdf"]) {
      await client.send(new PutObjectCommand({ Bucket: bucketName, Key: name, Body: "%PDF" }))
    }
  })

  it("lists the prefix page by page and deletes idempotently", async () => {
    const firstPage = await bucket.listPage({ prefix: "tmp/pdf-exports/", pageSize: 1 })
    expect(firstPage.objects.map((object) => object.name)).toEqual(["tmp/pdf-exports/1-a/a.pdf"])
    expect(firstPage.objects[0]?.createdAt).toBeInstanceOf(Date)
    expect(firstPage.nextPageToken).toEqual(expect.any(String))

    const secondPage = await bucket.listPage({
      prefix: "tmp/pdf-exports/",
      pageSize: 1,
      pageToken: firstPage.nextPageToken,
    })
    expect(secondPage.objects.map((object) => object.name)).toEqual(["tmp/pdf-exports/2-b/b.pdf"])
    expect(secondPage.nextPageToken).toBeUndefined()

    await bucket.delete("tmp/pdf-exports/1-a/a.pdf")
    await bucket.delete("tmp/pdf-exports/1-a/a.pdf")
    const afterDelete = await bucket.listPage({ prefix: "tmp/pdf-exports/", pageSize: 10 })
    expect(afterDelete.objects.map((object) => object.name)).toEqual(["tmp/pdf-exports/2-b/b.pdf"])
  })
})
