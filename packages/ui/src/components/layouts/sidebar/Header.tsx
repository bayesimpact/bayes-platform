import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@bayes-platform/ui/shad/sidebar"
import { type LucideIcon, PlugZap2Icon } from "lucide-react"
import { Link } from "react-router-dom"
import { cn } from "../../../lib/utils"

export function Header(props: HeaderButtonProps) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" asChild>
          <HeaderButton {...props} />
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

type HeaderButtonProps = {
  name?: string
  subname?: string
  subnameClassName?: string
  Icon?: LucideIcon
  to: string
  iconClassName?: string
  className?: string
  children?: React.ReactNode
}
export function HeaderButton({
  name = "Bayes Platform",
  subname,
  subnameClassName,
  Icon = PlugZap2Icon,
  to,
  iconClassName,
  className,
  children,
}: HeaderButtonProps) {
  return (
    <Link to={to} className={className}>
      {children ?? (
        <div
          className={cn(
            "bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg",
            iconClassName,
          )}
        >
          <Icon className="size-4" />
        </div>
      )}
      <div className="flex flex-col gap-0.5 leading-none">
        <span className="font-medium">{name}</span>
        {subname && <span className={subnameClassName}>{subname}</span>}
      </div>
    </Link>
  )
}
