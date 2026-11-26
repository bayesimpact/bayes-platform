import type { ExtractionDatasetSetupInputDto } from "@bayes-platform/eval-contracts"
import { useLingui } from "@lingui/react/macro"
import { type Control, Controller } from "react-hook-form"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { COLUMN_ROLE_LABELS, COLUMN_ROLES } from "@/lib/extraction-columns"

export type ExtractionColumnRowProps = {
  control: Control<ExtractionDatasetSetupInputDto>
  /** The place of the column in the file, counted from 0. */
  index: number
  /** The name the file gives the column. */
  originalName: string
  /** Whether the column is among those that take a role at once. */
  isChecked: boolean
  onToggle: () => void
}

/**
 * A column of the file, in the form that builds a dataset: its box, its number, its name in the
 * file, then the name it takes in the dataset and its role.
 */
export function ExtractionColumnRow({
  control,
  index,
  originalName,
  isChecked,
  onToggle,
}: ExtractionColumnRowProps) {
  const { t, i18n } = useLingui()
  return (
    <li className="grid grid-cols-[auto_auto_1fr] items-center gap-3 p-3 sm:grid-cols-[auto_auto_minmax(0,1fr)_minmax(0,1fr)_auto]">
      <Checkbox
        checked={isChecked}
        onCheckedChange={onToggle}
        aria-label={t`Select the column ${originalName}`}
      />
      <span className="font-mono text-xs text-muted-foreground tabular-nums">{index + 1}</span>
      <span className="truncate text-sm font-medium" title={originalName}>
        {originalName}
      </span>
      <Controller
        control={control}
        name={`columns.${index}.finalName`}
        render={({ field: nameField }) => (
          <Input
            {...nameField}
            className="col-span-3 sm:col-span-1"
            placeholder={originalName}
            aria-label={t`Name of the column ${originalName} in the dataset`}
          />
        )}
      />
      <Controller
        control={control}
        name={`columns.${index}.role`}
        render={({ field: roleField }) => (
          <NativeSelect
            {...roleField}
            className="col-span-3 sm:col-span-1"
            aria-label={t`Role of the column ${originalName}`}
          >
            {COLUMN_ROLES.map((role) => (
              <NativeSelectOption key={role} value={role}>
                {i18n._(COLUMN_ROLE_LABELS[role])}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      />
    </li>
  )
}
