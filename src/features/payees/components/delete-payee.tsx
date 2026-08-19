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
import type { Payee } from "@/features/payees/api";
import { useDeletePayee } from "@/features/payees/mutations";

/**
 * Delete-payee button + confirm dialog. Deletion is unconditional (ADR-0012): the
 * FKs are `SET NULL`, so linked transactions simply lose the payee label — no
 * reassignment flow. The dialog warns about the affected count so it isn't a surprise.
 */
export function DeletePayee({
	payee,
	children,
}: {
	payee: Payee;
	children?: React.ReactNode;
}) {
	const deletePayee = useDeletePayee();
	const [open, setOpen] = React.useState(false);
	const count = payee.transactionCount;

	return (
		<AlertDialog
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) deletePayee.reset();
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
					<AlertDialogTitle>Delete “{payee.name}”?</AlertDialogTitle>
					<AlertDialogDescription>
						{count > 0
							? `${count} transaction${count === 1 ? "" : "s"} linked to this payee will lose the label. This can't be undone.`
							: "This permanently removes the payee and can't be undone."}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={deletePayee.isPending}>
						Cancel
					</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						disabled={deletePayee.isPending}
						onClick={(e) => {
							e.preventDefault(); // wait for the server before closing
							deletePayee.mutate(payee.id, {
								onSuccess: () => setOpen(false),
							});
						}}
					>
						{deletePayee.isPending ? <Spinner /> : "Delete payee"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
