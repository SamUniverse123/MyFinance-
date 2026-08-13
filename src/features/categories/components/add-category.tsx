import { Plus } from "lucide-react";
import type * as React from "react";

import { Button } from "@/components/ui/button.tsx";
import type { Category } from "@/features/categories/api";
import {
	CategoryFormModal,
	DEFAULT_CATEGORY_COLOR,
} from "@/features/categories/category-form";
import { useCreateCategory } from "@/features/categories/mutations";
import { useGetCategories } from "@/features/categories/queries";

/**
 * Add-category trigger + responsive modal. Without `parent`, creates a new
 * top-level category of `kind`. With `parent`, creates a subcategory directly
 * under it — kind and parent are then fixed (ADR-0001: a subcategory's kind
 * always matches its parent's).
 */
export function AddCategory({
	kind,
	parent,
	children,
}: {
	kind: Category["kind"];
	parent?: Category;
	children?: React.ReactNode;
}) {
	const { data: categories } = useGetCategories();
	const createCategory = useCreateCategory();

	const trigger = children ?? (
		<Button size="sm" variant={parent ? "ghost" : "outline"}>
			<Plus />
			{parent ? "Add subcategory" : "Add category"}
		</Button>
	);

	return (
		<CategoryFormModal
			title={
				parent ? `Add subcategory to "${parent.name}"` : `Add ${kind} category`
			}
			description={
				parent
					? "Nest a more specific category underneath — subcategories share the parent's kind."
					: "Create a new top-level category."
			}
			submitLabel="Add category"
			categories={categories ?? []}
			kindEditable={!parent}
			parentEditable={!parent}
			defaultValues={{
				name: "",
				kind,
				color: DEFAULT_CATEGORY_COLOR,
				icon: "",
				parentId: parent?.id ?? null,
			}}
			onSubmit={async (v) => {
				await createCategory.mutateAsync({
					name: v.name.trim(),
					kind: v.kind,
					color: v.color,
					icon: v.icon || null,
					parentId: v.parentId,
				});
			}}
			trigger={trigger}
		/>
	);
}
