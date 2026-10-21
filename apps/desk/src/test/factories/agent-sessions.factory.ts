import {
  type ConversationSessionOutputDto,
  type CsvExtractionRunOutputDto,
  conversationSessionOutputSchema,
  csvExtractionRunOutputSchema,
  type ExtractionRunOutputDto,
  extractionRunOutputSchema,
} from "@caseai-connect/desk-contracts"

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000

/** The moment `days` days before now. */
export function daysAgo(days: number): number {
  return Date.now() - days * DAY_IN_MILLISECONDS
}

/** A conversation of the conversation history, checked against the contract. */
export function buildConversationSession(
  overrides: Partial<ConversationSessionOutputDto> = {},
): ConversationSessionOutputDto {
  return conversationSessionOutputSchema.parse({
    id: crypto.randomUUID(),
    title: "Compare the plans",
    createdAt: daysAgo(0),
    ...overrides,
  })
}

/** An extraction of one document, checked against the contract. */
export function buildExtractionRun(
  overrides: Partial<ExtractionRunOutputDto> = {},
): ExtractionRunOutputDto {
  return extractionRunOutputSchema.parse({
    id: crypto.randomUUID(),
    documentFileName: "summary.pdf",
    status: "success",
    createdAt: daysAgo(0),
    ...overrides,
  })
}

/** An extraction of a CSV file, checked against the contract. */
export function buildCsvExtractionRun(
  overrides: Partial<CsvExtractionRunOutputDto> = {},
): CsvExtractionRunOutputDto {
  return csvExtractionRunOutputSchema.parse({
    id: crypto.randomUUID(),
    status: "completed",
    createdAt: daysAgo(0),
    ...overrides,
  })
}
