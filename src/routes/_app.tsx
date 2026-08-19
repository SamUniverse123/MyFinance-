import { AppSidebar } from '#/components/app-sidebar'
import { CreateFab } from '#/components/create-fab'
import { SidebarProvider, SidebarInset,  } from '#/components/ui/sidebar'
import { createFileRoute, redirect, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_app')({
  beforeLoad: ({ context }) => {
    if (!context.session) {
      throw redirect({ to: '/login' })
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <Outlet />
      </SidebarInset>
      {/* Global mobile create action; hidden on desktop where header buttons remain. */}
      <CreateFab />
    </SidebarProvider>
  )
}
