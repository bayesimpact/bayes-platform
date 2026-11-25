import { SidebarGroup, SidebarGroupLabel, SidebarMenu } from "@bayes-platform/ui/shad/sidebar"

export function Section({
  name,
  className,
  children,
  options,
}: {
  name: string
  className?: string
  children: React.ReactNode
  options?: React.ReactNode
}) {
  return (
    <SidebarGroup className={className}>
      <div className="flex items-center gap-2">
        <SidebarGroupLabel className="uppercase">{name}</SidebarGroupLabel>
        <div className="shrink-0">{options}</div>
      </div>

      <SidebarMenu>{children}</SidebarMenu>
    </SidebarGroup>
  )
}
