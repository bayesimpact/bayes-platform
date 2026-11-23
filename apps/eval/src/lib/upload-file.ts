/**
 * Sends a file's bytes to the signed URL the API gave for it. This is the one `fetch` outside
 * `api-client.ts`, on purpose: the URL is the storage's, not the API's, and carries its own
 * signature, so it takes no bearer token, no `{ payload }` envelope and no response schema, and
 * the bytes skip the API. The URL is signed with the content type: storage refuses an upload
 * without the same one.
 */
export async function putFileToSignedUrl(
  uploadUrl: string,
  file: File,
  contentType: string,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
    signal,
  })
  if (!response.ok) throw new Error(`The storage answered ${response.status} to the upload`)
}
