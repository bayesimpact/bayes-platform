import { CONVERSATION_RUN_MAX_SCORE } from "@caseai-connect/eval-contracts"

/**
 * A score out of the best one, such as 4 / 5: the score of an answer, a whole number, or the
 * average of a run, with one decimal at most.
 */
export const scoreOf = (score: number, locale: string) => {
  const format = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  return `${format.format(score)} / ${format.format(CONVERSATION_RUN_MAX_SCORE)}`
}
