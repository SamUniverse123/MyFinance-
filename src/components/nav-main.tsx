import { Link } from "@tanstack/react-router";
import { CirclePlusIcon, MailIcon } from "lucide-react";
import { CreatePicker } from "#/components/create-picker.tsx";
import { Button } from "#/components/ui/button.tsx";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
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
	const { isMobile, setOpenMobile, state } = useSidebar();

	const closeMobileSidebar = () => {
		if (isMobile) setOpenMobile(false);
	};

	return (
		<SidebarGroup>
			<SidebarGroupContent className="flex flex-col gap-2">
				<SidebarMenu>
					<SidebarMenuItem className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
						{/* Create picker trigger — hidden inside the mobile Sheet, where the
						    FAB already owns "create" (grill Q2). Collapsed rail shows a round
						    button; expanded shows Quick Create. Both open the same picker. */}
						{!isMobile && (
							<CreatePicker>
								{(openPicker) =>
									state === "expanded" ? (
										<Button
											
											onClick={openPicker}
											className="metallic-interactive h-12 w-5/6 min-w-8 bg-primary text-zinc-100 duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
										>
											<CirclePlusIcon />
											<span>Quick Create</span>
										</Button>
									) : (
										<Button
											type="button"
											
											onClick={openPicker}
											aria-label="Create"
											className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-zinc-50 shadow-sm transition-transform hover:opacity-90 active:scale-95 [&_svg]:size-4"
										>
											<CirclePlusIcon />
										</Button>
									)
								}
							</CreatePicker>
						)}

						<Button
							size="icon"
							className="size-8 group-data-[collapsible=icon]:hidden"
							variant="outline"
						>
							<MailIcon />
							<span className="sr-only">Inbox</span>
						</Button>
					</SidebarMenuItem>
				</SidebarMenu>
				<SidebarMenu className="h-1/2">
					{items.map((item) => (
						<SidebarMenuItem key={item.title}>
							<SidebarMenuButton asChild tooltip={item.title}>
								{item.url.startsWith("/") ? (
									<Link
										to={item.url}
										activeProps={{ "data-active": "true" }}
										activeOptions={{ exact: item.url === "/dashboard" }}
										onClick={closeMobileSidebar}
									>
										{item.icon}
										<span>{item.title}</span>
									</Link>
								) : (
									<a href={item.url} onClick={closeMobileSidebar}>
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
