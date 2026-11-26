/** Letters that Unicode does not split into a base letter and an accent. */
const LETTERS_WITHOUT_DECOMPOSITION: Record<string, string> = {
  æ: "ae",
  œ: "oe",
  ø: "o",
  ß: "ss",
}

/**
 * The tool name a sub-agent gets by default: `ask_` and the name of the agent in lower case,
 * without accents, with `_` between the words. "Grand âge" gives `ask_grand_age`.
 */
export function buildDefaultToolName(agentName: string): string {
  const slug = agentName
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[æœøß]/g, (letter) => LETTERS_WITHOUT_DECOMPOSITION[letter] ?? letter)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
  return `ask_${slug || "sub_agent"}`
}
