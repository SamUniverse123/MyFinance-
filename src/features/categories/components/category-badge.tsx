import type { Category } from "@/features/categories/api";
import {
	getCategoryColor,
	getCategoryIconMeta,
} from "@/features/categories/category-visuals";
import { cn } from "@/lib/utils.ts";

/** Compact category chip (icon in a tinted circle + name), shared by the transactions
 *  list rows and table. Renders a neutral "Uncategorized" chip when the transaction has
 *  no category. */
export function CategoryBadge({
	category,
	className,
}: {
	category: Category | undefined;
	className?: string;
}) {
	if (!category) {
		return (
			<span
				className={cn(
					"inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground",
					className,
				)}
			>
				<span className="size-4 shrink-0 rounded-full bg-muted-foreground/20" />
				<span className="truncate">Uncategorized</span>
			</span>
		);
	}

	const meta = getCategoryIconMeta(category.icon);
	const Icon = meta.icon;
	const color = getCategoryColor(category.color);

	return (
		<span
			className={cn("inline-flex min-w-0 items-center gap-1.5 text-xs", className)}
		>
			<span
				className="flex size-4 shrink-0 items-center justify-center rounded-full"
				style={{ color, backgroundColor: `${color}1f` }}
			>
				<Icon className="size-2.5" />
			</span>
			<span className="truncate">{category.name}</span>
		</span>
	);
}
