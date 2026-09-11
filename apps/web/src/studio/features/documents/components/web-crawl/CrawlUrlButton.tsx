import { crawlUrlSchema } from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@caseai-connect/ui/shad/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@caseai-connect/ui/shad/form"
import { Input } from "@caseai-connect/ui/shad/input"
import { zodResolver } from "@hookform/resolvers/zod"
import { GlobeIcon, Loader2Icon } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { z } from "zod"
import { useAppDispatch } from "@/common/store/hooks"
import { crawlUrlDocling } from "../../documents.thunks"

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

  const form = useForm<CrawlUrlFormData>({
    resolver: zodResolver(crawlUrlSchema),
    defaultValues: { url: "", name: "" },
  })
  const { control, handleSubmit, formState } = form

  const onSubmit = async (data: CrawlUrlFormData) => {
    const payload = { url: data.url, name: data.name || undefined }
    await dispatch(crawlUrlDocling(payload)).unwrap()
    onSuccess()
  }

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogHeader>
          <DialogTitle>{t("document:crawl.title")}</DialogTitle>
          <DialogDescription>{t("document:crawl.description")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-4">
          <FormField
            control={control}
            name="url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("document:crawl.urlLabel")}</FormLabel>
                <FormControl>
                  <Input type="url" placeholder="https://example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("document:crawl.nameLabel")}</FormLabel>
                <FormControl>
                  <Input type="text" placeholder={t("document:crawl.namePlaceholder")} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={formState.isSubmitting}>
              {formState.isSubmitting && <Loader2Icon className="size-4 animate-spin" />}
              {t("document:crawl.submit")}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  )
}
