import { Button } from "@caseai-connect/ui/shad/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@caseai-connect/ui/shad/dialog"
import { Field, FieldGroup, FieldLabel } from "@caseai-connect/ui/shad/field"
import { Input } from "@caseai-connect/ui/shad/input"
import { zodResolver } from "@hookform/resolvers/zod"
import { GlobeIcon, Loader2Icon } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { useAppDispatch } from "@/common/store/hooks"
import { crawlUrl } from "../documents.thunks"

const crawlUrlSchema = z.object({
  url: z.string().url(),
  name: z.string(),
})

type CrawlUrlFormData = z.infer<typeof crawlUrlSchema>

export function CrawlUrlButton() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <GlobeIcon className="size-4" />
          <span>{useTranslation("document").t("document:crawl.button")}</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <CrawlUrlForm onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function CrawlUrlForm({ onSuccess }: { onSuccess: () => void }) {
  const dispatch = useAppDispatch()
  const { t } = useTranslation("document")

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CrawlUrlFormData>({
    resolver: zodResolver(crawlUrlSchema),
    defaultValues: { url: "", name: "" },
  })

  const onSubmit = async (data: CrawlUrlFormData) => {
    await dispatch(crawlUrl({ url: data.url, name: data.name.trim() || undefined })).unwrap()
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <DialogHeader>
        <DialogTitle>{t("document:crawl.title")}</DialogTitle>
        <DialogDescription>{t("document:crawl.description")}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4 pt-4">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="crawl-url">{t("document:crawl.urlLabel")}</FieldLabel>
            <Input
              id="crawl-url"
              type="url"
              placeholder="https://example.com"
              {...register("url")}
              aria-invalid={errors.url ? "true" : "false"}
            />
            {errors.url && <p className="text-sm text-destructive">{errors.url.message}</p>}
          </Field>
          <Field>
            <FieldLabel htmlFor="crawl-name">{t("document:crawl.nameLabel")}</FieldLabel>
            <Input
              id="crawl-name"
              type="text"
              placeholder={t("document:crawl.namePlaceholder")}
              {...register("name")}
            />
          </Field>
        </FieldGroup>
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2Icon className="size-4 animate-spin" />}
            {t("document:crawl.submit")}
          </Button>
        </div>
      </div>
    </form>
  )
}
