"use client"

import * as React from "react"

import {
  useSidebar,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "#/components/ui/sidebar.tsx"
import { Link } from "@tanstack/react-router"






export function NavSecondary({
  items,
  ...props
}: {
  items: {
    title: string
    url: string
    icon: React.ReactNode
  }[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {

  const{state, open ,setOpen, openMobile, setOpenMobile, isMobile} = useSidebar()

  const closeMobileSidebar = () =>{
    if(isMobile) setOpenMobile(false)
  }

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title} >
              <SidebarMenuButton asChild  >
                <Link to={item.url} onClick={closeMobileSidebar } >
                  {item.icon}
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
