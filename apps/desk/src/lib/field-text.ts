import type { I18n } from "@lingui/core"
import { msg } from "@lingui/core/macro"

/**
 * A field's key as words, since the Desk does not show the agent's schema to the person:
 * `numberOfParagraphs`, `number_of_paragraphs` and `number-of-paragraphs` read "Number of
 * paragraphs".
 */
export function fieldLabelOf(key: string): string {
  const words = key
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[\s_\-.]+/)
    .filter((word) => word !== "")
    // An acronym keeps its capitals: "PDF url" stays "PDF url".
    .map((word) => (word === word.toUpperCase() && word.length > 1 ? word : word.toLowerCase()))
  const sentence = words.join(" ")
  return sentence.charAt(0).toUpperCase() + sentence.slice(1)
}

const YES = msg({ message: "Yes", comment: "A field an agent filled in with true" })
const NO = msg({ message: "No", comment: "A field an agent filled in with false" })

/** Whether a value holds no object, so a list of them reads on one line. */
const isPlainValue = (value: unknown) => typeof value !== "object" || value === null

/**
 * A value an agent filled in, as plain text in the person's language, to show it in one line or
 * to copy it: a number with its separators, yes or no, a list of plain values joined by commas,
 * anything else as JSON. No value reads as an empty text.
 */
export function fieldTextOf(value: unknown, i18n: I18n): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  if (typeof value === "number") return i18n.number(value)
  if (typeof value === "boolean") return i18n._(value ? YES : NO)
  if (Array.isArray(value) && value.every(isPlainValue)) {
    return value
      .map((item) => fieldTextOf(item, i18n))
      .filter((text) => text !== "")
      .join(", ")
  }
  return JSON.stringify(value, null, 2)
}
