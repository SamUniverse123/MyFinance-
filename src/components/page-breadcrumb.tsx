import { Link } from "@tanstack/react-router";
import * as React from "react";

import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "#/components/ui/breadcrumb";

export type Crumb = {
	label: string;
	/** Route path to link to. Omit for the current (last) page. */
	to?: string;
};

/**
 * Header breadcrumb trail. The last crumb renders as the current page (non-link);
 * any crumb with a `to` renders as a router link. Feed it into `SiteHeader`'s
 * `breadcrumb` prop.
 */
export function PageBreadcrumb({ items }: { items: Crumb[] }) {
	return (
		<Breadcrumb>
			<BreadcrumbList>
				{items.map((item, i) => {
					const isLast = i === items.length - 1;
					return (
						<React.Fragment key={item.label}>
							<BreadcrumbItem>
								{isLast || !item.to ? (
									<BreadcrumbPage className="max-w-[40vw] truncate sm:max-w-xs text-lg font-semibold">
										{item.label}
									</BreadcrumbPage>
								) : (
									<BreadcrumbLink asChild>
										<Link to={item.to}>{item.label}</Link>
									</BreadcrumbLink>
								)}
							</BreadcrumbItem>
							{!isLast && <BreadcrumbSeparator />}
						</React.Fragment>
					);
				})}
			</BreadcrumbList>
		</Breadcrumb>
	);
}
