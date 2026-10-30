import {
  type ConversationMessageOutputDto,
  type ConversationSessionOutputDto,
  type CsvExtractionRunDetailOutputDto,
  conversationMessageOutputSchema,
  conversationSessionOutputSchema,
  csvExtractionRunDetailOutputSchema,
  type ExtractionRunOutputDto,
  extractionRunOutputSchema,
  toolCallOutputSchema,
} from "@caseai-connect/desk-contracts"
import type { z } from "zod"

type ToolCallOutputDto = z.output<typeof toolCallOutputSchema>

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
    forms: [],
    ...overrides,
  })
}

/** An extraction of one document, checked against the contract. */
export function buildExtractionRun(
  overrides: Partial<ExtractionRunOutputDto> = {},
): ExtractionRunOutputDto {
  const createdAt = overrides.createdAt ?? daysAgo(0)
  return extractionRunOutputSchema.parse({
    id: crypto.randomUUID(),
    documentId: crypto.randomUUID(),
    documentFileName: "summary.pdf",
    status: "success",
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  })
}

/** An extraction of a CSV file, checked against the contract. */
export function buildCsvExtractionRun(
  overrides: Partial<CsvExtractionRunDetailOutputDto> = {},
): CsvExtractionRunDetailOutputDto {
  const createdAt = overrides.createdAt ?? daysAgo(0)
  return csvExtractionRunDetailOutputSchema.parse({
    id: crypto.randomUUID(),
    csvDocumentId: crypto.randomUUID(),
    columnSchema: {},
    status: "completed",
    summary: null,
    csvExportDocumentId: null,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  })
}

/** A tool an agent called while it answered, checked against the contract. */
export function buildToolCall(overrides: Partial<ToolCallOutputDto> = {}): ToolCallOutputDto {
  return toolCallOutputSchema.parse({
    id: crypto.randomUUID(),
    name: "lookup_knowledge_base",
    arguments: {},
    ...overrides,
  })
}

/** A message of a conversation, checked against the contract. */
export function buildConversationMessage(
  overrides: Partial<ConversationMessageOutputDto> = {},
): ConversationMessageOutputDto {
  return conversationMessageOutputSchema.parse({
    id: crypto.randomUUID(),
    role: "assistant",
    content: "Hello! How can I help you today?",
    status: "completed",
    createdAt: daysAgo(0),
    ...overrides,
  })
}
