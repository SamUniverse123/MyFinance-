import { Link } from "@tanstack/react-router";
import {
	BadgeDollarSign,
	CameraIcon,
	CircleHelpIcon,
	DatabaseIcon,
	FileChartColumnIcon,
	FileIcon,
	FileTextIcon,
	LayoutDashboardIcon,
	ListIcon,
	SearchIcon,
	Settings2Icon,
	TagIcon,
	Wallet,
} from "lucide-react";
import type * as React from "react";
import { NavMain } from "#/components/nav-main.tsx";
import { NavSecondary } from "#/components/nav-secondary.tsx";
import { NavUser } from "#/components/nav-user.tsx";
import { SidebarBrandMark } from "#/components/sidebar-brand-mark.tsx";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "#/components/ui/sidebar.tsx";

const data = {
	user: {
		name: "shadcn",
		email: "m@example.com",
		avatar: "/avatars/shadcn.jpg",
	},
	navMain: [
		{
			title: "Dashboard",
			url: "/dashboard",
			icon: <LayoutDashboardIcon />,
		},
		{
			title: "Accounts",
			url: "/accounts",
			icon: <BadgeDollarSign />,
		},
		{
			title: "Transactions",
			url: "/transactions",
			icon: <ListIcon />,
		},
		{
			title: "Categories",
			url: "/categories",
			icon: <TagIcon />,
		},
		{
			title: "Budgets",
			url: "/budgets",
			icon: <Wallet />,
		},
	],
	navClouds: [
		{
			title: "Capture",
			icon: <CameraIcon />,
			isActive: true,
			url: "#",
			items: [
				{
					title: "Active Proposals",
					url: "#",
				},
				{
					title: "Archived",
					url: "#",
				},
			],
		},
		{
			title: "Proposal",
			icon: <FileTextIcon />,
			url: "#",
			items: [
				{
					title: "Active Proposals",
					url: "#",
				},
				{
					title: "Archived",
					url: "#",
				},
			],
		},
		{
			title: "Prompts",
			icon: <FileTextIcon />,
			url: "#",
			items: [
				{
					title: "Active Proposals",
					url: "#",
				},
				{
					title: "Archived",
					url: "#",
				},
			],
		},
	],
	navSecondary: [
		{
			title: "Settings",
			url: "#",
			icon: <Settings2Icon />,
		},
		{
			title: "Get Help",
			url: "#",
			icon: <CircleHelpIcon />,
		},
		{
			title: "Search",
			url: "#",
			icon: <SearchIcon />,
		},
	],
	documents: [
		{
			name: "Data Library",
			url: "#",
			icon: <DatabaseIcon />,
		},
		{
			name: "Reports",
			url: "#",
			icon: <FileChartColumnIcon />,
		},
		{
			name: "Word Assistant",
			url: "#",
			icon: <FileIcon />,
		},
	],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem >
						<div
							
							className="data-[slot=sidebar-menu-button]:p-3.5! h-12  "
						>
							<Link to={"/dashboard"}>
								<SidebarBrandMark />
							</Link>
						</div>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<NavMain items={data.navMain} />
				{/* <NavDocuments items={data.documents} /> */}
				<NavSecondary items={data.navSecondary} className="mt-auto" />
			</SidebarContent>
			<SidebarFooter>
				<NavUser user={data.user} />
			</SidebarFooter>
		</Sidebar>
	);
}
