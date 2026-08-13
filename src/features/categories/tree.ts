import type { Category } from "./api";

export type CategoryNode = Category & { children: Category[] };

/**
 * Flat list → two-level tree (ADR-0001 caps depth at 2, so this never recurses).
 * Optionally filtered to one kind — the transaction-form picker and the
 * management page's Income/Expense sections both need that.
 */
export function buildCategoryTree(
	categories: Category[],
	kind?: Category["kind"],
): CategoryNode[] {
	const filtered = kind
		? categories.filter((c) => c.kind === kind)
		: categories;
	const byParent = new Map<string, Category[]>();
	for (const c of filtered) {
		if (!c.parentId) continue;
		const list = byParent.get(c.parentId) ?? [];
		list.push(c);
		byParent.set(c.parentId, list);
	}

	return filtered
		.filter((c) => c.parentId === null)
		.slice()
		.sort((a, b) => a.sortOrder - b.sortOrder)
		.map((top) => ({
			...top,
			children: (byParent.get(top.id) ?? [])
				.slice()
				.sort((a, b) => a.sortOrder - b.sortOrder),
		}));
}
