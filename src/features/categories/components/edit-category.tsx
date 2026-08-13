import type * as React from "react";
import type { Category } from "@/features/categories/api";
import {
	CategoryFormModal,
	DEFAULT_CATEGORY_COLOR,
} from "@/features/categories/category-form";
import type { CategoryIconValue } from "@/features/categories/category-visuals";
import { useUpdateCategory } from "@/features/categories/mutations";
import { useGetCategories } from "@/features/categories/queries";

/**
 * Edit-category trigger + responsive modal, prefilled from `category`. System
 * categories (ADR-0002) can't be renamed or reorganized — only color/icon.
 * Kind can't change while the category has subcategories (ADR-0001).
 */
export function EditCategory({
	category,
	children,
}: {
	category: Category;
	children: React.ReactNode;
}) {
	const { data: categories } = useGetCategories();
	const updateCategory = useUpdateCategory(category.id);
	const hasChildren = (categories ?? []).some(
		(c) => c.parentId === category.id,
	);

	return (
		<CategoryFormModal
			title={`Edit "${category.name}"`}
			description="Update this category's details."
			submitLabel="Save changes"
			categories={categories ?? []}
			nameEditable={!category.isSystem}
			kindEditable={!category.isSystem && !hasChildren}
			parentEditable={!category.isSystem}
			defaultValues={{
				name: category.name,
				kind: category.kind,
				color: category.color ?? DEFAULT_CATEGORY_COLOR,
				icon: (category.icon ?? "") as CategoryIconValue | "",
				parentId: category.parentId,
			}}
			onSubmit={async (v) => {
				await updateCategory.mutateAsync({
					name: v.name.trim(),
					kind: v.kind,
					color: v.color,
					icon: v.icon || null,
					parentId: v.parentId,
				});
			}}
			trigger={children}
		/>
	);
}
