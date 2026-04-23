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
import { GlobeIcon, Loader2Icon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useAppDispatch } from "@/common/store/hooks"
import { crawlUrl } from "../documents.thunks"

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
  const [url, setUrl] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isValidUrl = (() => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  })()

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!isValidUrl || isSubmitting) return

    setIsSubmitting(true)
    try {
      await dispatch(crawlUrl({ url })).unwrap()
      onSuccess()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
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
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              required
            />
          </Field>
        </FieldGroup>
        <div className="flex justify-end">
          <Button type="submit" disabled={!isValidUrl || isSubmitting}>
            {isSubmitting && <Loader2Icon className="size-4 animate-spin" />}
            {t("document:crawl.submit")}
          </Button>
        </div>
      </div>
    </form>
  )
}
