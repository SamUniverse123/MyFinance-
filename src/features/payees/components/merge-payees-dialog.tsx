import * as React from "react";
import { Button } from "@/components/ui/button.tsx";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select.tsx";
import { Spinner } from "@/components/ui/spinner";
import type { Payee } from "@/features/payees/api";
import { useMergePayees } from "@/features/payees/mutations";

/** The most-used payee is the sensible default survivor. */
function defaultSurvivor(payees: Payee[]): string {
	return [...payees].sort((a, b) => b.transactionCount - a.transactionCount)[0]
		?.id;
}

/**
 * Merge dialog (Q14): the multi-selected payees collapse into one survivor. Every
 * transaction/scheduled/rule pointing at the others is repointed to the survivor and
 * the others are deleted — server-side, in one transaction.
 */
export function MergePayeesDialog({
	payees,
	open,
	onOpenChange,
	onMerged,
}: {
	payees: Payee[];
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onMerged?: () => void;
}) {
	const merge = useMergePayees();
	const [survivorId, setSurvivorId] = React.useState<string>(() =>
		defaultSurvivor(payees),
	);

	// Re-seed the survivor whenever the dialog opens with a fresh selection.
	React.useEffect(() => {
		if (open) setSurvivorId(defaultSurvivor(payees));
	}, [open, payees]);

	const survivor = payees.find((p) => p.id === survivorId);
	const losers = payees.filter((p) => p.id !== survivorId);
	const movedCount = losers.reduce((sum, p) => sum + p.transactionCount, 0);

	function submit() {
		if (!survivorId || merge.isPending) return;
		merge.mutate(
			{ survivorId, mergedIds: payees.map((p) => p.id) },
			{
				onSuccess: () => {
					onMerged?.();
					onOpenChange(false);
				},
			},
		);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[480px]">
				<DialogHeader>
					<DialogTitle>Merge {payees.length} payees</DialogTitle>
					<DialogDescription>
						Keep one payee and fold the rest into it. Every transaction linked
						to the others moves to the one you keep, then they're deleted. This
						can't be undone.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-2 py-2">
					<span className="text-sm font-medium">Keep</span>
					<Select value={survivorId} onValueChange={setSurvivorId}>
						<SelectTrigger className="w-full">
							<SelectValue placeholder="Choose the payee to keep" />
						</SelectTrigger>
						<SelectContent>
							{payees.map((p) => (
								<SelectItem key={p.id} value={p.id}>
									{p.name}
									<span className="text-muted-foreground">
										{p.transactionCount} txn
										{p.transactionCount === 1 ? "" : "s"}
									</span>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{survivor && (
						<p className="text-sm text-muted-foreground">
							{losers.length} payee{losers.length === 1 ? "" : "s"} and{" "}
							{movedCount} transaction{movedCount === 1 ? "" : "s"} will move
							into “{survivor.name}”.
						</p>
					)}
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={merge.isPending}
					>
						Cancel
					</Button>
					<Button onClick={submit} disabled={!survivorId || merge.isPending}>
						{merge.isPending ? <Spinner /> : "Merge payees"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
