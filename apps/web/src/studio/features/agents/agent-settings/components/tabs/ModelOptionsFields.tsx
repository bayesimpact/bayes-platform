import { Input } from "@caseai-connect/ui/shad/input"
import { Label } from "@caseai-connect/ui/shad/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@caseai-connect/ui/shad/select"
import { useTranslation } from "react-i18next"
import {
  type ModelOptionFields,
  readModelOption,
  writeModelOption,
} from "@/common/features/agents/agent-model.helpers"

/**
 * The options of the selected model: a temperature, a thinking level, or both, as its options
 * schema calls for. Presentational: the model tab owns the value and its validation.
 */
export function ModelOptionsFields({
  fields,
  value,
  onChange,
}: {
  fields: ModelOptionFields
  value: Record<string, unknown> | null
  onChange: (value: Record<string, unknown>) => void
}) {
  const { t } = useTranslation()
  const temperature = readModelOption(value, ["temperature"])
  const thinkingLevel = fields.thinkingLevel
    ? readModelOption(value, fields.thinkingLevel.path)
    : undefined

  return (
    <>
      {fields.temperature && (
        <div className="grid gap-2">
          <Label htmlFor="model-option-temperature">{t("agentSettings:props.temperature")}</Label>
          <Input
            id="model-option-temperature"
            type="number"
            step="0.01"
            min={fields.temperature.minimum}
            max={fields.temperature.maximum}
            placeholder={t("agentSettings:props.placeholders.temperature")}
            value={typeof temperature === "number" ? temperature : ""}
            onChange={(event) =>
              onChange(writeModelOption(value, ["temperature"], event.target.valueAsNumber))
            }
          />
        </div>
      )}

      {fields.thinkingLevel && (
        <div className="grid gap-2">
          <Label htmlFor="model-option-thinking-level">
            {t("agentSettings:props.thinkingLevel")}
          </Label>
          <Select
            value={typeof thinkingLevel === "string" ? thinkingLevel : undefined}
            onValueChange={(level) =>
              fields.thinkingLevel &&
              onChange(writeModelOption(value, fields.thinkingLevel.path, level))
            }
          >
            <SelectTrigger id="model-option-thinking-level">
              <SelectValue placeholder={t("agentSettings:props.placeholders.thinkingLevel")} />
            </SelectTrigger>
            <SelectContent>
              {fields.thinkingLevel.levels.map((level) => (
                <SelectItem key={level} value={level}>
                  {t(`agentSettings:props.thinkingLevels.${level}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  )
}
