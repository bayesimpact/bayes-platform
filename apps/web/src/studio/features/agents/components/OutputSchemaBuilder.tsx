import {
  getOrderedPropertyEntries,
  type OutputJsonSchemaProperty,
  outputJsonSchemaSchema,
} from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import { Checkbox } from "@caseai-connect/ui/shad/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@caseai-connect/ui/shad/dialog"
import { Input } from "@caseai-connect/ui/shad/input"
import { Label } from "@caseai-connect/ui/shad/label"
import { Popover, PopoverContent, PopoverTrigger } from "@caseai-connect/ui/shad/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@caseai-connect/ui/shad/select"
import { Switch } from "@caseai-connect/ui/shad/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@caseai-connect/ui/shad/table"
import { Textarea } from "@caseai-connect/ui/shad/textarea"
import { cn } from "@caseai-connect/ui/utils"
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  type Row,
  useReactTable,
} from "@tanstack/react-table"
import {
  GripVerticalIcon,
  HashIcon,
  ListChecksIcon,
  ListIcon,
  type LucideIcon,
  Maximize2Icon,
  PlusIcon,
  ToggleLeftIcon,
  Trash2Icon,
  TypeIcon,
  XIcon,
} from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import type { z } from "zod"

type OutputJsonSchema = z.infer<typeof outputJsonSchemaSchema>
type PropertyType = OutputJsonSchema["properties"][string]["type"]

// UI-facing field types. These are NOT the raw JSON Schema `type`s: "enum" is the builder's
// promotion of the `enum` keyword to a first-class choice (it stores a `string` property carrying
// an `enum` list), and `object` is intentionally not offered — nested objects stay in advanced
// JSON mode. The form runtime (buildFormFieldsZodSchema) builds a zod type for every JSON type,
// and extraction agents pass the schema straight to the provider.
type FieldType = "string" | "number" | "boolean" | "array" | "enum"
const FIELD_TYPES: FieldType[] = ["string", "number", "boolean", "array", "enum"]

const TYPE_ICONS: Record<FieldType, LucideIcon> = {
  string: TypeIcon,
  number: HashIcon,
  boolean: ToggleLeftIcon,
  array: ListIcon,
  enum: ListChecksIcon,
}

// A string property that carries an `enum` list is shown as the "enum" (Choice) type; everything
// else maps to its JSON type. An `object` field (only creatable in advanced mode) has no matching
// option, so the select renders blank until the author picks a listed type.
function fieldUiType(field: SchemaField): string {
  return field.constraints.enum !== undefined ? "enum" : field.type
}

// Switching TO enum seeds an empty `enum` list on a string property; switching AWAY drops it so a
// number/boolean/array/list field never keeps stale allowed-values.
function typeChangePatch(nextType: FieldType, field: SchemaField): Partial<SchemaField> {
  if (nextType === "enum") {
    return {
      type: "string",
      constraints: { ...field.constraints, enum: field.constraints.enum ?? [] },
    }
  }
  const { enum: _removed, ...constraints } = field.constraints
  return { type: nextType, constraints }
}

export type SchemaField = {
  id: string
  name: string
  type: PropertyType
  description: string
  required: boolean
  // Constraint keywords (enum, minimum, maximum, items). Carried verbatim through the fields
  // round-trip so touching a schema in visual mode never discards constraints authored in
  // advanced JSON mode, including `items` which the visual builder does not edit.
  constraints: Omit<OutputJsonSchemaProperty, "type" | "description">
}

// Per-column layout hints and the row handlers, both read from table meta so the column defs
// stay stable across renders.
type ColumnMeta = { className?: string }
type SchemaTableMeta = {
  disabled: boolean
  updateField: (id: string, patch: Partial<SchemaField>) => void
  removeField: (id: string) => void
}

/**
 * Converts a stored outputJsonSchema into the ordered, flat field list the builder edits.
 * Order follows `propertyOrdering` (via getOrderedPropertyEntries). Returns [] for schemas
 * that fail validation (e.g. invalid JSON typed in advanced mode).
 */
export function parseSchemaToFields(value: unknown): Omit<SchemaField, "id">[] {
  const parsed = outputJsonSchemaSchema.safeParse(value)
  if (!parsed.success) return []
  const requiredKeys = new Set(parsed.data.required ?? [])
  return getOrderedPropertyEntries(parsed.data).map(([name, property]) => {
    const { type, description, ...constraints } = property
    return {
      name,
      type,
      description: description ?? "",
      required: requiredKeys.has(name),
      constraints,
    }
  })
}

/**
 * Serializes the builder's field list back into an outputJsonSchema. Fields with a blank or
 * duplicate name are skipped. When `includeOrdering` is true, `propertyOrdering` mirrors the
 * field order so the LLM asks the questions in the arranged sequence; when false it is omitted
 * and the assistant is free to choose the order. `required` lists the toggled-required fields.
 */
export function fieldsToSchema(fields: SchemaField[], includeOrdering = true): OutputJsonSchema {
  const properties: OutputJsonSchema["properties"] = {}
  const propertyOrdering: string[] = []
  const required: string[] = []
  const seen = new Set<string>()

  for (const field of fields) {
    const name = field.name.trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    // An empty enum list is not a valid constraint (the contract requires at least one value), so
    // an in-progress "Choice" field with no values yet serializes as a plain string property.
    const { enum: enumValues, ...otherConstraints } = field.constraints
    properties[name] = {
      ...otherConstraints,
      ...(enumValues && enumValues.length > 0 ? { enum: enumValues } : {}),
      type: field.type,
      ...(field.description.trim() ? { description: field.description } : {}),
    }
    propertyOrdering.push(name)
    if (field.required) required.push(name)
  }

  return {
    type: "object",
    properties,
    ...(includeOrdering ? { propertyOrdering } : {}),
    ...(required.length > 0 ? { required } : {}),
  }
}

/**
 * Whether the ordering toggle should start on for a stored schema. Fresh or invalid schemas
 * default to on (the feature's default). A schema that already has fields but no
 * `propertyOrdering` starts off, so opening it never silently imposes an order.
 */
export function schemaEnablesOrdering(value: unknown): boolean {
  const parsed = outputJsonSchemaSchema.safeParse(value)
  if (!parsed.success) return true
  if (Object.keys(parsed.data.properties).length === 0) return true
  return (parsed.data.propertyOrdering?.length ?? 0) > 0
}

const makeField = (): SchemaField => ({
  id: crypto.randomUUID(),
  name: "",
  type: "string",
  description: "",
  required: false,
  constraints: {},
})

type Props = {
  value: unknown
  onChange: (schema: OutputJsonSchema) => void
  disabled?: boolean
  // Question order (propertyOrdering) is only meaningful for form agents that ask the fields
  // one by one; extraction agents fill the whole schema at once, so the toggle is hidden and
  // ordering is never emitted for them.
  allowOrdering?: boolean
}

export function OutputSchemaBuilder({
  value,
  onChange,
  disabled = false,
  allowOrdering = true,
}: Props) {
  const { t, i18n } = useTranslation()
  const [fields, setFields] = useState<SchemaField[]>(() =>
    parseSchemaToFields(value).map((field) => ({ ...field, id: crypto.randomUUID() })),
  )
  const [orderingEnabled, setOrderingEnabled] = useState(
    () => allowOrdering && schemaEnablesOrdering(value),
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Push every edit up as a fresh schema. Only user actions call this (never on mount), so the
  // form stays pristine until the author actually changes something.
  const commit = (nextFields: SchemaField[]) => {
    setFields(nextFields)
    onChange(fieldsToSchema(nextFields, orderingEnabled))
  }

  const toggleOrdering = (enabled: boolean) => {
    setOrderingEnabled(enabled)
    onChange(fieldsToSchema(fields, enabled))
  }

  const updateField = (id: string, patch: Partial<SchemaField>) => {
    commit(fields.map((field) => (field.id === id ? { ...field, ...patch } : field)))
  }

  const removeField = (id: string) => {
    commit(fields.filter((field) => field.id !== id))
  }

  const addField = () => {
    commit([...fields, makeField()])
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = fields.findIndex((field) => field.id === active.id)
    const to = fields.findIndex((field) => field.id === over.id)
    if (from === -1 || to === -1) return
    commit(arrayMove(fields, from, to))
  }

  const columns = useMemo<ColumnDef<SchemaField>[]>(
    () => [
      // Drag handle and order number only appear when the author controls the order. The
      // description column (w-full) absorbs the freed width, so dropping these two columns
      // doesn't reflow the rest of the table.
      ...(orderingEnabled
        ? ([
            {
              id: "drag",
              header: () => (
                <span className="sr-only">{t("agent:props.schemaBuilder.dragHandle")}</span>
              ),
              meta: { className: "w-8" } satisfies ColumnMeta,
              cell: ({ row, table }) => (
                <RowDragHandleCell
                  rowId={row.original.id}
                  disabled={(table.options.meta as SchemaTableMeta).disabled}
                />
              ),
            },
            {
              id: "order",
              header: () => <span className="text-muted-foreground">#</span>,
              meta: {
                className: "w-8 text-muted-foreground text-sm tabular-nums",
              } satisfies ColumnMeta,
              cell: ({ row }) => row.index + 1,
            },
          ] satisfies ColumnDef<SchemaField>[])
        : []),
      {
        accessorKey: "name",
        header: () => (
          <span className="text-muted-foreground">{t("agent:props.schemaBuilder.fieldName")}</span>
        ),
        meta: { className: "w-0 whitespace-nowrap" } satisfies ColumnMeta,
        cell: ({ row, table }) => {
          const meta = table.options.meta as SchemaTableMeta
          return (
            <FieldNameCell
              field={row.original}
              disabled={meta.disabled}
              onChange={(patch) => meta.updateField(row.original.id, patch)}
            />
          )
        },
      },
      {
        accessorKey: "type",
        header: () => (
          <span className="text-muted-foreground">{t("agent:props.schemaBuilder.type")}</span>
        ),
        meta: { className: "w-36" } satisfies ColumnMeta,
        cell: ({ row, table }) => {
          const meta = table.options.meta as SchemaTableMeta
          return (
            <TypeCell
              field={row.original}
              disabled={meta.disabled}
              onChange={(patch) => meta.updateField(row.original.id, patch)}
            />
          )
        },
      },
      {
        accessorKey: "required",
        header: () => (
          <span className="text-muted-foreground">{t("agent:props.schemaBuilder.required")}</span>
        ),
        meta: { className: "w-20" } satisfies ColumnMeta,
        cell: ({ row, table }) => {
          const meta = table.options.meta as SchemaTableMeta
          return (
            <Switch
              checked={row.original.required}
              disabled={meta.disabled}
              aria-label={t("agent:props.schemaBuilder.required")}
              onCheckedChange={(checked) =>
                meta.updateField(row.original.id, { required: checked })
              }
            />
          )
        },
      },
      {
        accessorKey: "description",
        header: () => (
          <span className="text-muted-foreground">
            {t("agent:props.schemaBuilder.description")}
          </span>
        ),
        meta: { className: "w-full max-w-0" } satisfies ColumnMeta,
        cell: ({ row, table }) => {
          const meta = table.options.meta as SchemaTableMeta
          return (
            <DescriptionCell
              field={row.original}
              disabled={meta.disabled}
              onChange={(patch) => meta.updateField(row.original.id, patch)}
            />
          )
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{t("agent:props.schemaBuilder.removeField")}</span>,
        meta: { className: "w-10" } satisfies ColumnMeta,
        cell: ({ row, table }) => {
          const meta = table.options.meta as SchemaTableMeta
          return (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={meta.disabled}
              onClick={() => meta.removeField(row.original.id)}
              aria-label={t("agent:props.schemaBuilder.removeField")}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2Icon />
            </Button>
          )
        },
      },
    ],
    [t, orderingEnabled],
  )

  const table = useReactTable({
    data: fields,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (field) => field.id,
    meta: { disabled, updateField, removeField } satisfies SchemaTableMeta,
  })

  return (
    <div className="flex flex-col gap-3">
      {allowOrdering && (
        <div className="flex items-start gap-2">
          <Checkbox
            id="schema-ordering"
            checked={orderingEnabled}
            disabled={disabled}
            className="mt-0.5"
            onCheckedChange={(checked) => toggleOrdering(checked === true)}
          />
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="schema-ordering" className="font-medium text-sm">
              {t("agent:props.schemaBuilder.orderQuestions")}
            </Label>
            <p className="text-muted-foreground text-xs">
              {t("agent:props.schemaBuilder.orderQuestionsHint")}
            </p>
          </div>
        </div>
      )}

      {fields.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-muted-foreground text-sm">
          {t("agent:props.schemaBuilder.empty")}
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={handleDragEnd}
        >
          <div className="overflow-hidden rounded-md border">
            <Table key={i18n.language + orderingEnabled.toString()}>
              <TableHeader className="bg-muted/50">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className={
                          (header.column.columnDef.meta as ColumnMeta | undefined)?.className
                        }
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                <SortableContext
                  items={fields.map((field) => field.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {table.getRowModel().rows.map((row) => (
                    <DraggableRow key={row.id} row={row} />
                  ))}
                </SortableContext>
              </TableBody>
            </Table>
          </div>
        </DndContext>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={addField}
        className="self-start"
      >
        <PlusIcon /> {t("agent:props.schemaBuilder.addField")}
      </Button>
    </div>
  )
}

function DraggableRow({ row }: { row: Row<SchemaField> }) {
  const { setNodeRef, transform, transition, isDragging } = useSortable({ id: row.original.id })

  return (
    <tr
      ref={setNodeRef}
      data-testid={`schema-field-${row.index}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "border-b transition-colors last:border-0",
        isDragging ? "relative z-10 bg-muted/60 shadow-sm" : "hover:bg-muted/40",
      )}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell
          key={cell.id}
          className={(cell.column.columnDef.meta as ColumnMeta | undefined)?.className}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </tr>
  )
}

function RowDragHandleCell({ rowId, disabled }: { rowId: string; disabled: boolean }) {
  const { t } = useTranslation()
  const { attributes, listeners } = useSortable({ id: rowId })

  return (
    <button
      type="button"
      aria-label={t("agent:props.schemaBuilder.dragHandle")}
      disabled={disabled}
      className="cursor-grab touch-none rounded p-1 text-muted-foreground/70 hover:bg-muted hover:text-foreground disabled:cursor-not-allowed active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <GripVerticalIcon className="size-4" />
    </button>
  )
}

function TypeCell({
  field,
  disabled,
  onChange,
}: {
  field: SchemaField
  disabled: boolean
  onChange: (patch: Partial<SchemaField>) => void
}) {
  const { t } = useTranslation()
  const uiType = fieldUiType(field)

  return (
    <div className="flex flex-col gap-1">
      <Select
        value={uiType}
        disabled={disabled}
        onValueChange={(nextType) => onChange(typeChangePatch(nextType as FieldType, field))}
      >
        <SelectTrigger className="h-8 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FIELD_TYPES.map((type) => {
            const TypeOptionIcon = TYPE_ICONS[type]
            return (
              <SelectItem key={type} value={type}>
                <TypeOptionIcon className="size-4" />
                {t(`agent:props.schemaBuilder.types.${type}`)}
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
      {uiType === "enum" && (
        <EnumValuesEditor field={field} disabled={disabled} onChange={onChange} />
      )}
      {uiType === "number" && (
        <NumberRangeEditor field={field} disabled={disabled} onChange={onChange} />
      )}
    </div>
  )
}

// Edits a number field's optional minimum / maximum bounds. Either bound may be left blank; a
// blank (or non-numeric) input clears that constraint so the field stays unbounded on that side.
function NumberRangeEditor({
  field,
  disabled,
  onChange,
}: {
  field: SchemaField
  disabled: boolean
  onChange: (patch: Partial<SchemaField>) => void
}) {
  const { t } = useTranslation()
  const { minimum, maximum } = field.constraints

  const setBound = (bound: "minimum" | "maximum", raw: string) => {
    const { [bound]: _removed, ...rest } = field.constraints
    const trimmed = raw.trim()
    const parsed = Number(trimmed)
    const constraints = trimmed === "" || Number.isNaN(parsed) ? rest : { ...rest, [bound]: parsed }
    onChange({ constraints })
  }

  let label = t("agent:props.schemaBuilder.rangeEmpty")
  if (minimum !== undefined && maximum !== undefined) {
    label = t("agent:props.schemaBuilder.rangeBoth", { min: minimum, max: maximum })
  } else if (minimum !== undefined) {
    label = t("agent:props.schemaBuilder.rangeMinOnly", { min: minimum })
  } else if (maximum !== undefined) {
    label = t("agent:props.schemaBuilder.rangeMaxOnly", { max: maximum })
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="truncate rounded border px-2 py-1 text-left text-muted-foreground text-xs hover:bg-muted disabled:cursor-not-allowed"
        >
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-72 flex-col gap-2">
        <div className="flex items-start gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <Label className="text-muted-foreground text-xs">
              {t("agent:props.schemaBuilder.rangeMin")}
            </Label>
            <Input
              type="number"
              value={minimum ?? ""}
              disabled={disabled}
              aria-label={t("agent:props.schemaBuilder.rangeMin")}
              className="h-8"
              onChange={(event) => setBound("minimum", event.target.value)}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <Label className="text-muted-foreground text-xs">
              {t("agent:props.schemaBuilder.rangeMax")}
            </Label>
            <Input
              type="number"
              value={maximum ?? ""}
              disabled={disabled}
              aria-label={t("agent:props.schemaBuilder.rangeMax")}
              className="h-8"
              onChange={(event) => setBound("maximum", event.target.value)}
            />
          </div>
        </div>
        <p className="text-muted-foreground text-xs">{t("agent:props.schemaBuilder.rangeHint")}</p>
      </PopoverContent>
    </Popover>
  )
}

// Edits a "Choice" field's allowed values as a list of removable chips. Each value is added
// trimmed and de-duplicated; a pending draft is flushed when the popover closes.
function EnumValuesEditor({
  field,
  disabled,
  onChange,
}: {
  field: SchemaField
  disabled: boolean
  onChange: (patch: Partial<SchemaField>) => void
}) {
  const { t } = useTranslation()
  const values = field.constraints.enum ?? []
  const [draft, setDraft] = useState("")

  const setValues = (nextValues: string[]) => {
    onChange({ constraints: { ...field.constraints, enum: nextValues } })
  }

  // Returns whether the draft produced a new value, so key handlers can decide to keep focus.
  const addDraft = () => {
    const value = draft.trim()
    setDraft("")
    if (!value || values.includes(value)) return
    setValues([...values, value])
  }

  const removeValue = (index: number) => {
    setValues(values.filter((_, valueIndex) => valueIndex !== index))
  }

  return (
    <Popover
      onOpenChange={(open) => {
        if (!open) addDraft()
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="truncate rounded border px-2 py-1 text-left text-muted-foreground text-xs hover:bg-muted disabled:cursor-not-allowed"
        >
          {values.length > 0
            ? t("agent:props.schemaBuilder.enumValues", { count: values.length })
            : t("agent:props.schemaBuilder.enumValuesEmpty")}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-72 flex-col gap-2">
        {values.length > 0 && (
          <ul className="flex max-h-52 flex-col gap-1 overflow-y-auto">
            {values.map((value, index) => (
              <li
                key={value}
                className="flex items-center gap-2 rounded border bg-muted/40 py-1 pr-1 pl-2"
              >
                <span className="flex-1 truncate text-sm">{value}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={disabled}
                  aria-label={t("agent:props.schemaBuilder.enumValueRemove", { value })}
                  className="size-6 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeValue(index)}
                >
                  <XIcon />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-1">
          <Input
            autoFocus
            value={draft}
            disabled={disabled}
            aria-label={t("agent:props.schemaBuilder.enumValueAdd")}
            placeholder={t("agent:props.schemaBuilder.enumValuesPlaceholder")}
            className="h-8"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                addDraft()
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={disabled || !draft.trim()}
            aria-label={t("agent:props.schemaBuilder.enumValueAdd")}
            className="size-8 shrink-0"
            onClick={addDraft}
          >
            <PlusIcon />
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          {t("agent:props.schemaBuilder.enumValuesHint")}
        </p>
      </PopoverContent>
    </Popover>
  )
}

function FieldNameCell({
  field,
  disabled,
  onChange,
}: {
  field: SchemaField
  disabled: boolean
  onChange: (patch: Partial<SchemaField>) => void
}) {
  const { t } = useTranslation()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="block text-left font-medium text-sm hover:underline disabled:cursor-not-allowed"
        >
          {field.name ? (
            field.name
          ) : (
            <span className="font-normal text-muted-foreground italic">
              {t("agent:props.schemaBuilder.fieldNameEmpty")}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <Input
          autoFocus
          value={field.name}
          aria-label={t("agent:props.schemaBuilder.fieldName")}
          placeholder={t("agent:props.schemaBuilder.fieldNamePlaceholder")}
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </PopoverContent>
    </Popover>
  )
}

function DescriptionCell({
  field,
  disabled,
  onChange,
}: {
  field: SchemaField
  disabled: boolean
  onChange: (patch: Partial<SchemaField>) => void
}) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="block w-full truncate text-left text-sm hover:underline disabled:cursor-not-allowed"
          >
            {field.description ? (
              field.description
            ) : (
              <span className="text-muted-foreground italic">
                {t("agent:props.schemaBuilder.descriptionEmpty")}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="flex w-96 flex-col gap-2">
          <Textarea
            autoFocus
            value={field.description}
            rows={5}
            aria-label={t("agent:props.schemaBuilder.description")}
            placeholder={t("agent:props.schemaBuilder.descriptionPlaceholder")}
            className="max-h-64 resize-none overflow-y-auto"
            onChange={(event) => onChange({ description: event.target.value })}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => setExpanded(true)}
            className="self-end text-muted-foreground"
          >
            <Maximize2Icon /> {t("agent:props.schemaBuilder.expandDescription")}
          </Button>
        </PopoverContent>
      </Popover>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{field.name || t("agent:props.schemaBuilder.description")}</DialogTitle>
          </DialogHeader>
          <Textarea
            autoFocus
            value={field.description}
            rows={16}
            aria-label={t("agent:props.schemaBuilder.description")}
            placeholder={t("agent:props.schemaBuilder.descriptionPlaceholder")}
            className="max-h-[60vh] resize-none overflow-y-auto"
            onChange={(event) => onChange({ description: event.target.value })}
          />
          <DialogFooter>
            <Button type="button" onClick={() => setExpanded(false)}>
              {t("actions:close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
