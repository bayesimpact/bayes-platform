import type {
  CsvColumnDto,
  CsvColumnRoleDto,
  CsvFileColumnOutputDto,
} from "@caseai-connect/desk-contracts"

/** The role of each column, by its id. */
export type ColumnRoles = Record<string, CsvColumnRoleDto>

/** Every column starts as one the agent reads. */
export function initialColumnRoles(columns: CsvFileColumnOutputDto[]): ColumnRoles {
  return Object.fromEntries(columns.map((column) => [column.id, "input" as const]))
}

/** The columns as the API takes them, by their id, in the file's order. */
export function toColumnSchema(
  columns: CsvFileColumnOutputDto[],
  roles: ColumnRoles,
): Record<string, CsvColumnDto> {
  return Object.fromEntries(
    columns.map((column, index) => [
      column.id,
      {
        id: column.id,
        originalName: column.name,
        finalName: column.name,
        role: roles[column.id] ?? "input",
        index,
      },
    ]),
  )
}

/** Whether the agent reads at least one column: it has nothing to read otherwise. */
export function readsAColumn(roles: ColumnRoles): boolean {
  return Object.values(roles).includes("input")
}

/** The first values of a column, as one short line: "Alpha, Beta, Gamma". */
export function sampleOf(values: unknown[], count = 3): string {
  return values
    .filter((value) => value !== null && value !== undefined && String(value).trim() !== "")
    .slice(0, count)
    .map((value) => String(value).replace(/\s+/g, " ").trim())
    .join(", ")
}
