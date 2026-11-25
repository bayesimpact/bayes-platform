import { cn } from "@bayes-platform/ui/utils"

export function FullPageCenterLayout({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-1 items-center justify-center p-4", className)}>{children}</div>
  )
}
