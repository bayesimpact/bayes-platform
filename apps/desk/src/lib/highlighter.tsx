import type { CSSProperties } from "react"
import { createHighlighterCore, type GrammarState, type HighlighterCore } from "shiki/core"
import { createJavaScriptRegexEngine } from "shiki/engine/javascript"
import { hasOwnKey } from "./has-own-key"

/** The languages the Desk highlights, each loaded the first time a code block uses it. */
const LANGUAGES = {
  bash: () => import("shiki/langs/shellscript.mjs"),
  css: () => import("shiki/langs/css.mjs"),
  diff: () => import("shiki/langs/diff.mjs"),
  html: () => import("shiki/langs/html.mjs"),
  javascript: () => import("shiki/langs/javascript.mjs"),
  json: () => import("shiki/langs/json.mjs"),
  jsx: () => import("shiki/langs/jsx.mjs"),
  markdown: () => import("shiki/langs/markdown.mjs"),
  python: () => import("shiki/langs/python.mjs"),
  sql: () => import("shiki/langs/sql.mjs"),
  tsx: () => import("shiki/langs/tsx.mjs"),
  typescript: () => import("shiki/langs/typescript.mjs"),
  yaml: () => import("shiki/langs/yaml.mjs"),
}

type Language = keyof typeof LANGUAGES

/** The other names a code block gives these languages. */
const ALIASES = {
  js: "javascript",
  md: "markdown",
  py: "python",
  sh: "bash",
  shell: "bash",
  shellscript: "bash",
  ts: "typescript",
  yml: "yaml",
  zsh: "bash",
} satisfies Record<string, Language>

let highlighter: Promise<HighlighterCore> | undefined

function getHighlighter(): Promise<HighlighterCore> {
  highlighter ??= createHighlighterCore({
    themes: [import("shiki/themes/github-light.mjs"), import("shiki/themes/github-dark.mjs")],
    langs: [],
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  })
  return highlighter
}

/** The language a code block names, by its name or an alias, or `null` for any other. */
function languageOf(language: string): Language | "ansi" | null {
  const name = language.toLowerCase()
  // Terminal output, which shiki colors without a grammar.
  if (name === "ansi") return name
  if (hasOwnKey(LANGUAGES, name)) return name
  return hasOwnKey(ALIASES, name) ? ALIASES[name] : null
}

/**
 * Loads a language and returns a highlighter for it, or `null` for a language the Desk does not
 * highlight. Its `highlight` returns one React node per line, and the grammar state after the
 * last line, which a later call takes to go on where the code left off.
 */
export async function loadHighlighter(language: string) {
  const lang = languageOf(language)
  if (!lang) return null

  const shiki = await getHighlighter()
  if (lang !== "ansi" && !shiki.getLoadedLanguages().includes(lang)) {
    await shiki.loadLanguage(LANGUAGES[lang])
  }

  return {
    highlight(code: string, state?: GrammarState) {
      const tokenize = (text: string) =>
        shiki.codeToTokens(text, {
          lang,
          themes: { light: "github-light", dark: "github-dark" },
          defaultColor: false,
          grammarState: state,
        }).tokens

      // ANSI has no grammar state, so each line is tokenized on its own and gets the same colors
      // whether it arrives in one piece or streams.
      const tokens =
        lang === "ansi" ? code.split("\n").flatMap((line) => tokenize(line)) : tokenize(code)

      return {
        lines: tokens.map((line) =>
          line.map((token, index) => (
            <span
              // A line's tokens never move: a token's position in its line is its identity.
              // biome-ignore lint/suspicious/noArrayIndexKey: see above.
              key={index}
              // Safe: shiki's style holds CSS declarations and its `--shiki-*` color variables,
              // all strings, which each token gets from its grammar and no class can hold.
              style={token.htmlStyle as CSSProperties}
              className="text-(--shiki-light) dark:text-(--shiki-dark)"
            >
              {token.content}
            </span>
          )),
        ),
        state: shiki.getLastGrammarState(tokens),
      }
    },
  }
}
