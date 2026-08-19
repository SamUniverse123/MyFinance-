import { Merge, Pencil, Trash2, X } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table.tsx";
import type { Payee } from "@/features/payees/api";
import { PayeeAvatar } from "@/features/payees/components/payee-avatar";
import { DeletePayee } from "./delete-payee";
import { EditPayee } from "./edit-payee";
import { MergePayeesDialog } from "./merge-payees-dialog";

/**
 * Payee management list (Q15): name + transaction count per row, with checkbox
 * multi-select feeding the merge flow (Q14). Per-row rename/delete. Bulk delete is
 * intentionally not here — merge is the only multi-select action (Q17).
 */
export function PayeesTable({ payees }: { payees: Payee[] }) {
	const [selected, setSelected] = React.useState<Set<string>>(new Set());
	const [mergeOpen, setMergeOpen] = React.useState(false);

	// Server returns them ordered by lower(name); keep that order.
	const allSelected = payees.length > 0 && selected.size === payees.length;
	const someSelected = selected.size > 0 && !allSelected;
	const selectedPayees = payees.filter((p) => selected.has(p.id));

	function toggle(id: string) {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	function toggleAll() {
		setSelected((prev) =>
			prev.size === payees.length
				? new Set()
				: new Set(payees.map((p) => p.id)),
		);
	}

	const clear = () => setSelected(new Set());

	return (
		<div className="flex flex-col gap-3">
			{selected.size > 0 && (
				<div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
					<span className="font-medium">{selected.size} selected</span>
					<span className="text-muted-foreground">
						{selected.size < 2 && "· select 2 or more to merge"}
					</span>
					<div className="ml-auto flex items-center gap-2">
						<Button
							size="sm"
							variant="outline"
							disabled={selected.size < 2}
							onClick={() => setMergeOpen(true)}
						>
							<Merge className="size-4" />
							Merge
						</Button>
						<Button size="sm" variant="ghost" onClick={clear}>
							<X className="size-4" />
							Clear
						</Button>
					</div>
				</div>
			)}

			<div className="overflow-hidden rounded-xl border bg-card">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-10">
								<Checkbox
									aria-label="Select all payees"
									checked={
										allSelected ? true : someSelected ? "indeterminate" : false
									}
									onCheckedChange={toggleAll}
								/>
							</TableHead>
							<TableHead>Name</TableHead>
							<TableHead className="text-right">Transactions</TableHead>
							<TableHead className="w-24 text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{payees.map((payee) => (
							<TableRow
								key={payee.id}
								data-state={selected.has(payee.id) ? "selected" : undefined}
							>
								<TableCell>
									<Checkbox
										aria-label={`Select ${payee.name}`}
										checked={selected.has(payee.id)}
										onCheckedChange={() => toggle(payee.id)}
									/>
								</TableCell>
								<TableCell className="font-medium">
									<span className="flex items-center gap-2.5">
										<PayeeAvatar
											name={payee.name}
											domain={payee.domain}
											size={28}
										/>
										<span className="truncate">{payee.name}</span>
									</span>
								</TableCell>
								<TableCell className="text-right tabular-nums text-muted-foreground">
									{payee.transactionCount}
								</TableCell>
								<TableCell className="text-right">
									<div className="flex items-center justify-end gap-1">
										<EditPayee payee={payee}>
											<Button
												variant="ghost"
												size="icon-sm"
												aria-label="Rename"
											>
												<Pencil />
											</Button>
										</EditPayee>
										<DeletePayee payee={payee}>
											<Button
												variant="ghost"
												size="icon-sm"
												aria-label="Delete"
												className="text-muted-foreground hover:text-destructive"
											>
												<Trash2 />
											</Button>
										</DeletePayee>
									</div>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>

			<MergePayeesDialog
				payees={selectedPayees}
				open={mergeOpen}
				onOpenChange={setMergeOpen}
				onMerged={clear}
			/>
		</div>
	);
}
