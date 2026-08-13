import {
	type QueryKey,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import type {
	Category,
	CreateCategoryInput,
	UpdateCategoryInput,
} from "@/features/categories/api.ts";
import { categoriesApi } from "@/features/categories/api.ts";
import { transactionKeys } from "@/features/transactions/queries";
import type { HttpError } from "../shared/http";
import { categoryKeys } from "./queries";

type UpdateCategoryContext = {
	previousLists: [QueryKey, Category[] | undefined][];
};

export function useCreateCategory() {
	const queryClient = useQueryClient();
	const mutation = useMutation<Category, HttpError, CreateCategoryInput>({
		mutationFn: (json) => categoriesApi.create(json),
		onSuccess: (category) => {
			toast.success(`Category "${category.name}" created`);
			return queryClient.invalidateQueries({ queryKey: categoryKeys.all });
		},
		onError: (err) => {
			toast.error(err.status < 500 ? err.message : "Failed to create category");
		},
	});

	return mutation;
}

export function useUpdateCategory(id: string) {
	const queryClient = useQueryClient();
	const listFilter = { queryKey: categoryKeys.all } as const;

	return useMutation<
		Category,
		HttpError,
		UpdateCategoryInput,
		UpdateCategoryContext
	>({
		mutationFn: (json) => categoriesApi.update(id, json),

		// optimistic — renames, recolors, reparents, reorders are a foregone conclusion
		// server-side; see docs/design/frontend-architecture.md §5.
		onMutate: async (patch) => {
			await queryClient.cancelQueries(listFilter);

			const previousLists = queryClient.getQueriesData<Category[]>(listFilter);

			queryClient.setQueriesData<Category[]>(listFilter, (old) =>
				old?.map((c) => (c.id === id ? { ...c, ...patch } : c)),
			);

			return { previousLists };
		},

		onError: (err, _patch, ctx) => {
			ctx?.previousLists?.forEach(([key, data]) => {
				queryClient.setQueryData(key, data);
			});
			toast.error(err.status < 500 ? err.message : "Failed to update category");
		},

		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: categoryKeys.all });
			// rows may embed category display fields — see the invalidation matrix in
			// docs/design/frontend-architecture.md §5.
			queryClient.invalidateQueries({ queryKey: transactionKeys.all });
		},
	});
}

/** Drag-reorder within a kind section (or within a parent's children) — see Q13/task #7. */
export function useReorderCategories() {
	const queryClient = useQueryClient();

	return useMutation<void, HttpError, { id: string; sortOrder: number }[]>({
		mutationFn: async (updates) => {
			await Promise.all(
				updates.map(({ id, sortOrder }) =>
					categoriesApi.update(id, { sortOrder }),
				),
			);
		},
		onMutate: async (updates) => {
			await queryClient.cancelQueries({ queryKey: categoryKeys.all });
			const order = new Map(updates.map((u) => [u.id, u.sortOrder]));
			queryClient.setQueriesData<Category[]>(
				{ queryKey: categoryKeys.all },
				(old) =>
					old?.map((c) =>
						order.has(c.id) ? { ...c, sortOrder: order.get(c.id)! } : c,
					),
			);
		},
		onError: () => {
			toast.error("Failed to save the new order");
			queryClient.invalidateQueries({ queryKey: categoryKeys.all });
		},
	});
}

export function useDeleteCategory() {
	const queryClient = useQueryClient();

	// variables carry both the id and an optional reassignment target, so one hook
	// instance can retry the same delete once the caller has picked a replacement
	// (see docs/adr/0003-category-deletion-requires-reassignment.md).
	return useMutation<
		void,
		HttpError,
		{ id: string; reassignTo?: string | null }
	>({
		mutationFn: ({ id, reassignTo }) =>
			categoriesApi.remove(
				id,
				reassignTo !== undefined ? { reassignTo } : undefined,
			),

		// NOT optimistic — delete can be refused with a 409 carrying the dependent
		// counts (childCount/transactionCount/...), same reasoning as useDeleteAccount.
		onSuccess: () => {
			toast.success("Category deleted");
			queryClient.invalidateQueries({ queryKey: categoryKeys.all });
			queryClient.invalidateQueries({ queryKey: transactionKeys.all });
		},

		onError: (err) => {
			// 409 = still referenced (ADR-0003). Expected branch, not a failure to bury in
			// a toast: the confirm dialog reads err.detail and offers a reassignment picker.
			if (err.status === 409) return;
			toast.error(err.status < 500 ? err.message : "Failed to delete category");
		},
	});
}
