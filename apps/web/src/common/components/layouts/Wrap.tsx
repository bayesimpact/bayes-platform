import { cn } from "@bayes-platform/ui/utils"

export function Wrap({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden md:m-0 xl:m-10 2xl:mx-30 border-b xl:border xl:rounded-2xl",
        className,
      )}
    >
      {children}
    </div>
  )
}
