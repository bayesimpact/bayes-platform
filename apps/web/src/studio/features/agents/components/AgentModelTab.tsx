import { AgentModel, AgentModelToAgentProvider, AgentProvider } from "@caseai-connect/api-contracts"
import { Field, FieldGroup, FieldLabel } from "@caseai-connect/ui/shad/field"
import { Input } from "@caseai-connect/ui/shad/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@caseai-connect/ui/shad/select"
import { Controller, useFormContext } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useFeatureFlags } from "@/common/hooks/use-feature-flags"
import { useValue } from "@/common/hooks/use-value"
import type { AgentFormValues } from "./agent-form.shared"

function extractModelList(
  hasFeature: ReturnType<typeof useFeatureFlags>["hasFeature"],
): [string, AgentModel][] {
  const defaultModels = Object.entries(AgentModel).filter(
    ([_key, value]) => AgentModelToAgentProvider[value] === AgentProvider.Vertex,
  ) as [string, AgentModel][]
  let mistralModels: [string, AgentModel][] = []
  let medGemmaModels: [string, AgentModel][] = []
  let gemmaModels: [string, AgentModel][] = []
  if (hasFeature("mistral")) {
    mistralModels = Object.entries(AgentModel).filter(
      ([_key, value]) => AgentModelToAgentProvider[value] === AgentProvider.Mistral,
    ) as [string, AgentModel][]
  }
  if (hasFeature("gemma")) {
    gemmaModels = Object.entries(AgentModel).filter(
      ([_key, value]) => AgentModelToAgentProvider[value] === AgentProvider.Gemma,
    ) as [string, AgentModel][]
  }
  if (hasFeature("medgemma")) {
    medGemmaModels = Object.entries(AgentModel).filter(
      ([_key, value]) => AgentModelToAgentProvider[value] === AgentProvider.MedGemma,
    ) as [string, AgentModel][]
  }
  return [...defaultModels, ...medGemmaModels, ...gemmaModels, ...mistralModels]
}

export function AgentModelTab() {
  const { t } = useTranslation()
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<AgentFormValues>()

  const project = useValue(selectCurrentProjectData)
  const { hasFeature } = useFeatureFlags(project)
  const models = extractModelList(hasFeature)

  return (
    <FieldGroup>
      <div className="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="model">{t("agent:props.model")}</FieldLabel>
          <Controller
            control={control}
            name="model"
            render={({ field }) => (
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <SelectTrigger id="model" aria-invalid={errors.model ? "true" : "false"}>
                  <SelectValue placeholder={t("agent:props.placeholders.model")} />
                </SelectTrigger>
                <SelectContent>
                  {models.map(([key, value]) => (
                    <SelectItem key={key} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.model && <p className="text-sm text-destructive">{errors.model.message}</p>}
        </Field>

        <Field>
          <FieldLabel htmlFor="temperature">{t("agent:props.temperature")}</FieldLabel>
          <Input
            id="temperature"
            type="number"
            step="0.01"
            min="0"
            max="2"
            placeholder={t("agent:props.placeholders.temperature")}
            {...register("temperature", { valueAsNumber: true })}
            aria-invalid={errors.temperature ? "true" : "false"}
          />
          {errors.temperature && (
            <p className="text-sm text-destructive">{errors.temperature.message}</p>
          )}
        </Field>
      </div>
    </FieldGroup>
  )
}
