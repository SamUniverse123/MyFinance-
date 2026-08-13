import { Trash2 } from "lucide-react";
import * as React from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Spinner } from "@/components/ui/spinner";
import type { Category } from "@/features/categories/api";
import { CategoryCombobox } from "@/features/categories/components/category-combobox";
import { useDeleteCategory } from "@/features/categories/mutations";
import { useGetCategories } from "@/features/categories/queries";

type ConflictDetail = {
	childCount: number;
	transactionCount: number;
	scheduledCount: number;
	splitCount: number;
	ruleCount: number;
};

/**
 * Delete-category button + confirm dialog. Mirrors `delete-account.tsx`'s "not
 * optimistic, 409 shown inline" pattern — see ADR-0003. A 409 means the category
 * is still referenced; the dialog then asks for a replacement category (or "none",
 * which uncategorizes transactions and promotes subcategories to top-level) and
 * resubmits the delete with that choice.
 */
export function DeleteCategory({
	category,
	children,
}: {
	category: Category;
	children?: React.ReactNode;
}) {
	const { data: categories } = useGetCategories();
	const deleteCategory = useDeleteCategory();
	const [open, setOpen] = React.useState(false);
	const [reassignTo, setReassignTo] = React.useState<string | null>(null);

	const conflict =
		deleteCategory.error?.status === 409
			? (deleteCategory.error.detail as ConflictDetail | undefined)
			: undefined;

	if (category.isSystem) return null;

	const inUseParts = conflict
		? [
				conflict.childCount > 0 &&
					`${conflict.childCount} subcategor${conflict.childCount === 1 ? "y" : "ies"}`,
				conflict.transactionCount > 0 &&
					`${conflict.transactionCount} transaction${conflict.transactionCount === 1 ? "" : "s"}`,
				conflict.scheduledCount > 0 &&
					`${conflict.scheduledCount} scheduled transaction${conflict.scheduledCount === 1 ? "" : "s"}`,
				conflict.splitCount > 0 &&
					`${conflict.splitCount} split${conflict.splitCount === 1 ? "" : "s"}`,
				conflict.ruleCount > 0 &&
					`${conflict.ruleCount} rule${conflict.ruleCount === 1 ? "" : "s"}`,
			].filter(Boolean)
		: [];

	const noneLabel =
		conflict && conflict.childCount > 0
			? "None — uncategorize transactions, promote subcategories to top level"
			: "None — leave transactions uncategorized";

	return (
		<AlertDialog
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) {
					deleteCategory.reset();
					setReassignTo(null);
				}
			}}
		>
			<AlertDialogTrigger asChild>
				{children ?? (
					<Button variant="ghost" size="sm">
						<Trash2 />
						Delete
					</Button>
				)}
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete “{category.name}”?</AlertDialogTitle>
					<AlertDialogDescription>
						This permanently removes the category and can't be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>

				{conflict && (
					<div className="flex flex-col gap-3">
						<p className="text-sm text-destructive">
							This category is still in use ({inUseParts.join(", ")}). Pick
							where those should go before deleting it.
						</p>
						<CategoryCombobox
							categories={(categories ?? []).filter(
								(c) => c.id !== category.id,
							)}
							kind={category.kind}
							value={reassignTo}
							onChange={setReassignTo}
							allowNone
							noneLabel={noneLabel}
							placeholder="Reassign to…"
						/>
					</div>
				)}

				<AlertDialogFooter>
					<AlertDialogCancel disabled={deleteCategory.isPending}>
						Cancel
					</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						disabled={deleteCategory.isPending}
						onClick={(e) => {
							e.preventDefault(); // wait for the server's answer before closing
							deleteCategory.mutate(
								{ id: category.id, ...(conflict ? { reassignTo } : {}) },
								{ onSuccess: () => setOpen(false) },
							);
						}}
					>
						{deleteCategory.isPending ? (
							<Spinner />
						) : conflict ? (
							"Reassign and delete"
						) : (
							"Delete category"
						)}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
