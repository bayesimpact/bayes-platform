import type {
  AgentVersionOutputDto,
  ExtractionDatasetColumnDto,
  ExtractionRunKeyMappingEntryDto,
  ExtractionRunRecordOutputDto,
} from "@bayes-platform/eval-contracts"
import { hasOwnKey } from "@/lib/has-own-key"

/** The fields a version of an extraction agent returns: the properties of its output schema. */
export function outputKeysOf(version: Pick<AgentVersionOutputDto, "outputJsonSchema">): string[] {
  const properties = version.outputJsonSchema?.properties
  if (typeof properties !== "object" || properties === null) return []
  return Object.keys(properties)
}

/**
 * How a new run reads each field of a version, at first: compared with the target column of the
 * same name, whatever its case, or with none yet.
 */
export function defaultKeyMappingOf(
  version: Pick<AgentVersionOutputDto, "outputJsonSchema">,
  targetColumns: ExtractionDatasetColumnDto[],
): ExtractionRunKeyMappingEntryDto[] {
  return outputKeysOf(version).map((agentOutputKey) => ({
    agentOutputKey,
    datasetColumnId:
      targetColumns.find(
        (column) => column.finalName.toLowerCase() === agentOutputKey.toLowerCase(),
      )?.id ?? "",
    mode: "scored",
  }))
}

/**
 * Whether a mapping is ready for a run: it holds a field, and each scored field has its column.
 */
export const isKeyMappingComplete = (mapping: ExtractionRunKeyMappingEntryDto[]) =>
  mapping.length > 0 &&
  mapping.every((entry) => entry.mode === "fyi" || entry.datasetColumnId !== "")

/** The scored fields of a record that match, and how many are scored: none before a comparison. */
export function matchedFieldsOf(
  comparison: Record<string, { status: "match" | "mismatch" | "fyi" }> | null,
): { matched: number; scored: number } | null {
  if (!comparison) return null
  const scored = Object.values(comparison).filter((field) => field.status !== "fyi")
  return {
    matched: scored.filter((field) => field.status === "match").length,
    scored: scored.length,
  }
}

/**
 * A field of a record of a run, by its key. An agent names its fields: a key such as
 * `constructor` must index the record's own fields only.
 */
export const comparedFieldOf = (
  comparison: ExtractionRunRecordOutputDto["comparison"],
  key: string,
) => (comparison && hasOwnKey(comparison, key) ? comparison[key] : undefined)
