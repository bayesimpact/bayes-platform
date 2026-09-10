/** Splits a server-sent events body into its frames, each a list of non-empty lines. */
export function parseSseBlocks(text: string): string[][] {
  return text
    .split("\n\n")
    .map((block) => block.split("\n").filter((line) => line.length > 0))
    .filter((lines) => lines.length > 0)
}

/** The JSON payload of every `data:` line of a server-sent events body. */
export function parseSseDataEvents<Event>(text: string): Event[] {
  return parseSseBlocks(text)
    .map((lines) => lines.find((line) => line.startsWith("data:")))
    .filter((line): line is string => Boolean(line))
    .map((line) => JSON.parse(line.slice("data:".length).trim()) as Event)
}
