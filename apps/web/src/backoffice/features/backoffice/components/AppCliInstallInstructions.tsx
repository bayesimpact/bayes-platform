import { Button } from "@caseai-connect/ui/shad/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@caseai-connect/ui/shad/dialog"
import { CheckIcon, CopyIcon } from "lucide-react"
import { useState } from "react"
import { useCopyToClipboard } from "@/common/hooks/use-copy-to-clipboard"

export function AppCliInstallButton({ name, slug }: { name: string; slug: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const command = `bayes apps install ${slug} --frontend ${window.location.origin}`

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setIsOpen(true)}>
        How to install
      </Button>
      <Dialog open={isOpen} onOpenChange={(open) => !open && setIsOpen(false)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader className="min-w-0">
            <DialogTitle>Install {name}</DialogTitle>
            <DialogDescription>
              Run this with the bayes CLI. It opens the install page for this app. After you
              approve, the terminal prints the client id and client secret once. Save the secret. It
              cannot be retrieved later.
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">Command</span>
              <CopyCommandButton command={command} />
            </div>
            <div className="min-w-0 overflow-auto overscroll-contain rounded-md border bg-muted/50">
              <pre className="w-max p-3 font-mono text-xs leading-5">{command}</pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function CopyCommandButton({ command }: { command: string }) {
  const { copy, isCopied } = useCopyToClipboard("Copied")
  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      aria-label="Copy command"
      onClick={() => copy(command)}
    >
      {isCopied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
    </Button>
  )
}
