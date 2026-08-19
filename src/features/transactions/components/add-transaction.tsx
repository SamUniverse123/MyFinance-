import { Plus } from "lucide-react";
import type * as React from "react";

import { Button } from "@/components/ui/button.tsx";
import { useGetAccounts } from "@/features/accounts/queries";
import { useCreateCategory } from "@/features/categories/mutations";
import { useGetCategories } from "@/features/categories/queries";
import { useCreatePayee } from "@/features/payees/mutations";
import { useGetPayees } from "@/features/payees/queries";
import { useCreateTransaction } from "@/features/transactions/mutations";
import {
	TransactionFormModal,
	todayISO,
	toMinorUnits,
} from "@/features/transactions/transaction-form";

/**
 * Add-transaction trigger + responsive modal. Optionally pre-selects `accountId`
 * (e.g. when launched from an account's page). Omit `children` for the default button.
 */
export function AddTransaction({
	accountId,
	children,
}: {
	accountId?: string;
	children?: React.ReactNode;
}) {
	const { data: accounts } = useGetAccounts();
	const { data: categories } = useGetCategories();
	const { data: payees } = useGetPayees();
	const createTransaction = useCreateTransaction();
	const createCategory = useCreateCategory();
	const createPayee = useCreatePayee();
	const list = accounts ?? [];

	const trigger = children ?? (
		<Button>
			<Plus />
			Add transaction
		</Button>
	);

	return (
		<TransactionFormModal
			title="Add transaction"
			description="Record money moving in or out of an account."
			submitLabel="Add transaction"
			accounts={list}
			categories={categories ?? []}
			payees={payees ?? []}
			onCreateCategory={(input) => createCategory.mutateAsync(input)}
			onCreatePayee={(name) => createPayee.mutateAsync({ name })}
			trigger={trigger}
			defaultValues={{
				accountId: accountId ?? list[0]?.id ?? "",
				direction: "expense",
				amount: "",
				categoryId: null,
				date: todayISO(),
				payeeId: null,
				note: "",
				status: "cleared",
			}}
			onSubmit={async (v) => {
				const account = list.find((a) => a.id === v.accountId);
				if (!account) throw new Error("No account selected");
				const signed =
					toMinorUnits(v.amount) * (v.direction === "expense" ? -1 : 1);
				await createTransaction.mutateAsync({
					accountId: v.accountId,
					amount: signed,
					categoryId: v.categoryId,
					currency: account.currency,
					date: v.date,
					payeeId: v.payeeId,
					note: v.note.trim() || null,
					status: v.status,
				});
			}}
		/>
	);
}
