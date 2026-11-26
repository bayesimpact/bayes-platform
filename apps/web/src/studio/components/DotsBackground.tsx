import { cn } from "@bayes-platform/ui/utils"

export function DotsBackground({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("relative overflow-hidden h-full", className)}>
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, black 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />
      {children}
    </div>
  )
}
