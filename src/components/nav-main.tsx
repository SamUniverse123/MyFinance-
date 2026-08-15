import { Link } from "@tanstack/react-router";
import { CirclePlusIcon, MailIcon } from "lucide-react";
import { Button } from "#/components/ui/button.tsx";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "#/components/ui/sidebar.tsx";

export function NavMain({
	items,
}: {
	items: {
		title: string;
		url: string;
		icon?: React.ReactNode;
	}[];
}) {
	return (
		<SidebarGroup>
			<SidebarGroupContent className="flex flex-col gap-2">
				<SidebarMenu>
					<SidebarMenuItem className="flex items-center gap-2">
						<Button
							variant="spun-silver"
							className="min-w-8 w-5/6 h-12 metallic-interactive
							 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground metallic-interactive"
						>
							<CirclePlusIcon />
							<span>Quick Create</span>
						</Button>
						<Button
							size="icon"
							className="size-8 group-data-[collapsible=icon]:opacity-0"
							variant="outline"
						>
							<MailIcon />
							<span className="sr-only">Inbox</span>
						</Button>
					</SidebarMenuItem>
				</SidebarMenu>
				<SidebarMenu>
					{items.map((item) => (
						<SidebarMenuItem key={item.title}>
							<SidebarMenuButton asChild tooltip={item.title}>
								{item.url.startsWith("/") ? (
									<Link
										to={item.url}
										activeProps={{ "data-active": "true" }}
										activeOptions={{ exact: item.url === "/dashboard" }}
									>
										{item.icon}
										<span>{item.title}</span>
									</Link>
								) : (
									<a href={item.url}>
										{item.icon}
										<span>{item.title}</span>
									</a>
								)}
							</SidebarMenuButton>
						</SidebarMenuItem>
					))}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}
