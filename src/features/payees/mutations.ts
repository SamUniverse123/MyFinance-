import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { transactionKeys } from "@/features/transactions/queries";
import type { HttpError } from "../shared/http";
import type {
	CreatePayeeInput,
	MergePayeesInput,
	PayeeRow,
	UpdatePayeeInput,
} from "./api";
import { payeesApi } from "./api";
import { payeeKeys } from "./queries";

export function useCreatePayee() {
	const queryClient = useQueryClient();
	return useMutation<PayeeRow, HttpError, CreatePayeeInput>({
		mutationFn: (json) => payeesApi.create(json),
		// No toast here: creation happens inline from the entry-form combobox, where a
		// success toast on every new payee would be noise. Just refresh the list.
		onSuccess: () => queryClient.invalidateQueries({ queryKey: payeeKeys.all }),
		onError: (err) =>
			toast.error(err.status < 500 ? err.message : "Failed to create payee"),
	});
}

export function useUpdatePayee(id: string) {
	const queryClient = useQueryClient();
	return useMutation<PayeeRow, HttpError, UpdatePayeeInput>({
		mutationFn: (json) => payeesApi.update(id, json),
		onSuccess: (payee) => {
			toast.success(`Renamed to "${payee.name}"`);
			queryClient.invalidateQueries({ queryKey: payeeKeys.all });
			// transaction rows resolve their payee's display name (transactions.md §2.5).
			queryClient.invalidateQueries({ queryKey: transactionKeys.all });
		},
		onError: (err) =>
			toast.error(err.status < 500 ? err.message : "Failed to rename payee"),
	});
}

export function useDeletePayee() {
	const queryClient = useQueryClient();
	return useMutation<void, HttpError, string>({
		mutationFn: (id) => payeesApi.remove(id),
		onSuccess: () => {
			toast.success("Payee deleted");
			queryClient.invalidateQueries({ queryKey: payeeKeys.all });
			queryClient.invalidateQueries({ queryKey: transactionKeys.all });
		},
		onError: (err) =>
			toast.error(err.status < 500 ? err.message : "Failed to delete payee"),
	});
}

export function useMergePayees() {
	const queryClient = useQueryClient();
	return useMutation<PayeeRow, HttpError, MergePayeesInput>({
		mutationFn: (json) => payeesApi.merge(json),
		onSuccess: (survivor, { mergedIds }) => {
			const n = mergedIds.filter((m) => m !== survivor.id).length;
			toast.success(
				`Merged ${n} payee${n === 1 ? "" : "s"} into "${survivor.name}"`,
			);
			queryClient.invalidateQueries({ queryKey: payeeKeys.all });
			queryClient.invalidateQueries({ queryKey: transactionKeys.all });
		},
		onError: (err) =>
			toast.error(err.status < 500 ? err.message : "Failed to merge payees"),
	});
}
