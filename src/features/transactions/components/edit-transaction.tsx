import type * as React from "react";

import { useGetAccounts } from "@/features/accounts/queries";
import { useCreateCategory } from "@/features/categories/mutations";
import { useGetCategories } from "@/features/categories/queries";
import type { Transaction } from "@/features/transactions/api";
import { useUpdateTransaction } from "@/features/transactions/mutations";
import {
	magnitudeText,
	TransactionFormModal,
	type TxnStatus,
	toMinorUnits,
} from "@/features/transactions/transaction-form";

/**
 * Edit-transaction trigger + responsive modal, prefilled from `transaction`.
 * Supply the trigger via `children`.
 */
export function EditTransaction({
	transaction,
	children,
}: {
	transaction: Transaction;
	children: React.ReactNode;
}) {
	const { data: accounts } = useGetAccounts();
	const { data: categories } = useGetCategories();
	const updateTransaction = useUpdateTransaction(transaction.id);
	const createCategory = useCreateCategory();
	const list = accounts ?? [];

	return (
		<TransactionFormModal
			title="Edit transaction"
			description="Update this transaction's details."
			submitLabel="Save changes"
			accounts={list}
			categories={categories ?? []}
			onCreateCategory={(input) => createCategory.mutateAsync(input)}
			trigger={children}
			defaultValues={{
				accountId: transaction.accountId,
				direction: transaction.amount < 0 ? "expense" : "income",
				amount: magnitudeText(transaction.amount),
				categoryId: transaction.categoryId,
				date: transaction.date,
				payeeName: transaction.payeeName ?? "",
				note: transaction.note ?? "",
				status: transaction.status as TxnStatus,
			}}
			onSubmit={async (v) => {
				const account = list.find((a) => a.id === v.accountId);
				const signed =
					toMinorUnits(v.amount) * (v.direction === "expense" ? -1 : 1);
				await updateTransaction.mutateAsync({
					accountId: v.accountId,
					amount: signed,
					categoryId: v.categoryId,
					currency: account?.currency ?? transaction.currency,
					date: v.date,
					payeeName: v.payeeName.trim() || null,
					note: v.note.trim() || null,
					status: v.status,
				});
			}}
		/>
	);
}
