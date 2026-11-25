import {
  type CreateBackofficeCustomModelRequestDto,
  createBackofficeCustomModelSchema,
} from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import { DialogFooter } from "@caseai-connect/ui/shad/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@caseai-connect/ui/shad/form"
import { Input } from "@caseai-connect/ui/shad/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@caseai-connect/ui/shad/select"
import { Switch } from "@caseai-connect/ui/shad/switch"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import type { CustomModelType } from "../../backoffice.models"

export type CustomModelFormValues = CreateBackofficeCustomModelRequestDto

/**
 * The fields of a custom model, shared by the create and update dialogs. The type is locked once
 * the model exists. The stored key is never shown: an empty field keeps it.
 */
export function CustomModelForm({
  types,
  defaultValues,
  typeLocked,
  hasStoredKey,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  types: CustomModelType[]
  defaultValues: CustomModelFormValues
  typeLocked: boolean
  hasStoredKey: boolean
  submitLabel: string
  onSubmit: (values: CustomModelFormValues) => Promise<void>
  onCancel: () => void
}) {
  const form = useForm<CustomModelFormValues>({
    resolver: zodResolver(createBackofficeCustomModelSchema),
    defaultValues,
  })
  const removesKey = form.watch("apiKey") === null

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Gemma 4 on the new server" autoComplete="off" />
              </FormControl>
              <FormDescription>Shown in the model list of the agents.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="baseModel"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <Select value={field.value} onValueChange={field.onChange} disabled={typeLocked}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pick a self-hosted model" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {types.map((type) => (
                    <SelectItem key={type.model} value={type.model}>
                      {type.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                {typeLocked
                  ? "The type cannot change: the agents using this model keep its options."
                  : "The model the server runs: its options and behaviour apply."}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="baseUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Server URL</FormLabel>
              <FormControl>
                <Input {...field} placeholder="https://vllm.example.org/v1" autoComplete="off" />
              </FormControl>
              <FormDescription>Must use https and reach a public address.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="servedModelName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Served model name</FormLabel>
              <FormControl>
                <Input
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  value={field.value ?? ""}
                  onChange={(event) =>
                    field.onChange(event.target.value === "" ? null : event.target.value)
                  }
                  placeholder={form.watch("baseModel") || "Same as the type"}
                  autoComplete="off"
                />
              </FormControl>
              <FormDescription>
                Only when the server knows the model by another name than its type.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="apiKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>API key</FormLabel>
              <FormControl>
                <Input
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  type="password"
                  disabled={removesKey}
                  value={field.value ?? ""}
                  onChange={(event) =>
                    field.onChange(event.target.value === "" ? undefined : event.target.value)
                  }
                  placeholder={hasStoredKey ? "A key is stored: empty keeps it" : "No key"}
                  autoComplete="new-password"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {hasStoredKey && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm">Remove the stored key</span>
            <Switch
              checked={removesKey}
              onCheckedChange={(checked) =>
                form.setValue("apiKey", checked ? null : undefined, { shouldDirty: true })
              }
            />
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}
