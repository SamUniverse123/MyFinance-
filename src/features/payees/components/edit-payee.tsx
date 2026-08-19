import type * as React from "react";
import type { Payee } from "@/features/payees/api";
import { useUpdatePayee } from "@/features/payees/mutations";
import { PayeeFormModal } from "./payee-form";

/** Rename-payee trigger + modal, prefilled from `payee`. Supply the trigger via `children`. */
export function EditPayee({
	payee,
	children,
}: {
	payee: Payee;
	children: React.ReactNode;
}) {
	const updatePayee = useUpdatePayee(payee.id);

	return (
		<PayeeFormModal
			title={`Edit "${payee.name}"`}
			description="Update the name or attach a brand logo. Linked transactions update automatically."
			submitLabel="Save"
			defaultName={payee.name}
			defaultDomain={payee.domain ?? ""}
			onSubmit={async ({ name, domain }) => {
				await updatePayee.mutateAsync({ name, domain });
			}}
			trigger={children}
		/>
	);
}
