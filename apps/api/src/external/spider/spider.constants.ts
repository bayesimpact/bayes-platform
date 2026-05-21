export const SPIDER_API_KEY_ENV = "SPIDER_API_KEY"

export function resolveSpiderApiKey(): string {
  const apiKey = process.env[SPIDER_API_KEY_ENV]
  if (!apiKey) {
    throw new Error(`${SPIDER_API_KEY_ENV} environment variable is not set`)
  }
  return apiKey
}
