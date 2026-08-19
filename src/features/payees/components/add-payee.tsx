import { Plus } from "lucide-react";
import type * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { useCreatePayee } from "@/features/payees/mutations";
import { PayeeFormModal } from "./payee-form";

/**
 * Add-payee trigger + modal. Creation is an upsert (transactions.md §2.5): adding a
 * name that already exists resolves to the existing payee rather than erroring.
 */
export function AddPayee({ children }: { children?: React.ReactNode }) {
	const createPayee = useCreatePayee();

	const trigger = children ?? (
		<Button size="sm">
			<Plus />
			Add payee
		</Button>
	);

	return (
		<PayeeFormModal
			title="Add payee"
			description="Search a brand for its logo, or type any name."
			submitLabel="Add payee"
			onSubmit={async ({ name, domain }) => {
				const created = await createPayee.mutateAsync({ name, domain });
				toast.success(`Payee "${created.name}" added`);
			}}
			trigger={trigger}
		/>
	);
}
