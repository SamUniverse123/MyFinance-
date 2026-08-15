import { Separator } from "#/components/ui/separator.tsx";
import { SidebarTrigger } from "#/components/ui/sidebar.tsx";

export function SiteHeader({
	title,
	breadcrumb,
	actions,
}: {
	/** Plain page title. Ignored when `breadcrumb` is provided. */
	title?: string;
	/** Breadcrumb trail rendered in place of the plain title (see ui/breadcrumb). */
	breadcrumb?: React.ReactNode;
	actions?: React.ReactNode;
}) {
	return (
		<header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
			<div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
				<SidebarTrigger className="-ml-1" />
				<Separator
					orientation="vertical"
					className="mx-2 data-[orientation=vertical]:h-4"
				/>
				{breadcrumb ?? <h1 className="text-base font-medium">{title}</h1>}
				{actions && (
					<div className="ml-auto flex items-center gap-2">{actions}</div>
				)}
			</div>
		</header>
	);
}
