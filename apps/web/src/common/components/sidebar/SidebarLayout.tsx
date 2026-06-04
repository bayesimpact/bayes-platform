import { LayoutHeader } from "@caseai-connect/ui/components/layouts/header"
import { NavUser } from "@caseai-connect/ui/components/layouts/sidebar/NavUser"
import type { User } from "@caseai-connect/ui/components/layouts/sidebar/types"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarProvider,
} from "@caseai-connect/ui/shad/sidebar"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import type { Organization } from "@/common/features/organizations/organizations.models"
import { RouteNames } from "@/common/routes/helpers"
import type { DeskRoutes } from "@/desk/routes/helpers"
import { isStudioInterface, type StudioRoutes } from "@/studio/routes/helpers"
import { Logo } from "../themes/Logo"
import { EditProfileDialog } from "./nav/EditProfileDialog"
import { NavUserMenuItems } from "./nav/NavUserMenuItems"
import { SidebarBreadcrumb } from "./SidebarBreadcrumb"

export function SidebarLayout({
  user,
  organization,
  children,
  sidebarContentChildren,
  sidebarFooterChildren,
  hideIcon,
  routes,
  defaultOpen = true,
}: {
  user: User
  organization?: Organization
  children: React.ReactNode
  sidebarContentChildren?: React.ReactNode
  sidebarFooterChildren?: React.ReactNode
  hideIcon?: boolean
  routes?: typeof StudioRoutes | typeof DeskRoutes
  defaultOpen?: boolean
}) {
  const [editProfileOpen, setEditProfileOpen] = useState(false)

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
      defaultOpen={defaultOpen}
    >
      <Sidebar variant="inset" collapsible="offcanvas">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <HeaderWithLogo organization={organization} />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>{sidebarContentChildren}</SidebarContent>

        {sidebarFooterChildren}

        <SidebarFooter>
          <NavUser user={user}>
            <NavUserMenuItems onEditProfile={() => setEditProfileOpen(true)} />
          </NavUser>
          <EditProfileDialog open={editProfileOpen} onClose={() => setEditProfileOpen(false)} />
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <LayoutHeader
          hideIcon={hideIcon}
          title={
            organization &&
            routes && <SidebarBreadcrumb organization={organization} routes={routes} />
          }
        />

        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}

export function HeaderWithLogo({ organization }: { organization?: Organization }) {
  const navigate = useNavigate()
  const onClick = () => {
    navigate(RouteNames.HOME)
  }
  return (
    <div className="flex flex-1 gap-2 items-center">
      <button type="button" onClick={onClick} className="p-1 size-10 contain-content">
        <Logo />
      </button>

      <button type="button" onClick={onClick} className="flex-1">
        <div className="flex flex-col gap-0 leading-none text-left">
          {organization && <span className="font-medium text-lg">{organization?.name}</span>}

          {isStudioInterface() && <span className="text-primary capitalize-first">Studio</span>}
        </div>
      </button>
    </div>
  )
}
