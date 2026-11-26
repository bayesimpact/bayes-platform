import { Input } from "@bayes-platform/ui/shad/input"
import { Label } from "@bayes-platform/ui/shad/label"
import { RadioGroup, RadioGroupItem } from "@bayes-platform/ui/shad/radio-group"
import { useTranslation } from "react-i18next"

export function RunScopeSelector({
  recordCount,
  runScope,
  limitedCount,
  onRunScopeChange,
  onLimitedCountChange,
}: {
  recordCount: number | null
  runScope: "all" | "limited"
  limitedCount: number
  onRunScopeChange: (scope: "all" | "limited") => void
  onLimitedCountChange: (value: string) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-2 p-4 border rounded-md">
      <Label className="text-lg">{t("agentCsvExtractionRun:scope.title")}</Label>
      <RadioGroup
        value={runScope}
        onValueChange={(value) => onRunScopeChange(value as "all" | "limited")}
        className="flex flex-col gap-2"
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="all" id="scope-all" />
          <Label htmlFor="scope-all" className="cursor-pointer font-normal">
            {recordCount != null
              ? t("agentCsvExtractionRun:scope.all", { count: recordCount })
              : t("agentCsvExtractionRun:scope.allUnknown")}
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="limited" id="scope-limited" />
          <Label htmlFor="scope-limited" className="cursor-pointer font-normal">
            {t("agentCsvExtractionRun:scope.limited")}
          </Label>
          {runScope === "limited" && (
            <Input
              type="number"
              min={1}
              max={recordCount ?? undefined}
              value={limitedCount}
              onChange={(event) => onLimitedCountChange(event.target.value)}
              className="w-24"
            />
          )}
        </div>
      </RadioGroup>
    </div>
  )
}
