import { Button } from "@caseai-connect/ui/shad/button"
import { FileDownIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useAppDispatch } from "@/common/store/hooks"
import { getDocumentTemporaryUrl } from "@/studio/features/documents/documents.thunks"

type OpenerDisplayProps = {
  buttonProps?: React.ComponentProps<typeof Button>
} & ({ noText?: boolean; noIcon: never } | { noIcon?: boolean })

export function DocumentOpener({
  documentId,
  ...rest
}: { documentId: string } & OpenerDisplayProps) {
  const dispatch = useAppDispatch()
  const getUrl = () => dispatch(getDocumentTemporaryUrl({ documentId })).unwrap()
  return <FileOpener getUrl={getUrl} {...rest} />
}

/** Download button for a file served through a temporary URL that `getUrl` fetches on click. */
export function FileOpener({
  getUrl,
  buttonProps,
  ...rest
}: { getUrl: () => Promise<{ url: string }> } & OpenerDisplayProps) {
  const { t } = useTranslation()
  const [url, setUrl] = useState<string | null>(null)
  const aRef = useRef<HTMLAnchorElement | null>(null)

  const hasText = "noText" in rest ? !rest.noText : true
  const hasIcon = "noIcon" in rest ? !rest.noIcon : true

  const fetchUrl = async () => {
    if (url) return
    const res = await getUrl()
    setUrl(res.url)
  }

  useEffect(() => {
    if (!url) return
    if (aRef.current) {
      aRef.current.click()
    }
    return () => {
      setUrl(null)
    }
  }, [url])

  const content = (
    <>
      {hasIcon && <FileDownIcon className="size-4" />} {hasText && t("actions:downloadDocument")}
    </>
  )

  if (!url)
    return (
      <Button variant="outline" onClick={fetchUrl} {...buttonProps}>
        {content}
      </Button>
    )
  return (
    <Button variant="outline" asChild {...buttonProps}>
      <a ref={aRef} href={url} target="_blank" download>
        {content}
      </a>
    </Button>
  )
}
