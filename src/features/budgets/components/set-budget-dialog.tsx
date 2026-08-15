import * as React from "react";
import { getSymbol, toCurrencyCode } from "#/lib/currency";
import { Button } from "@/components/ui/button.tsx";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Spinner } from "@/components/ui/spinner";

/** "12.50" → 1250 minor units; blank/invalid → null (clears the budget). */
function parseMinor(input: string): number | null {
	const trimmed = input.trim();
	if (!trimmed) return null;
	const n = Number(trimmed);
	return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

/**
 * Reusable set/clear-amount dialog shared by the overall budget and each category
 * budget. `onSubmit` receives minor units (or null to clear) and returns the mutation
 * promise — the dialog closes on resolve and stays open on reject (the mutation owns
 * the error toast).
 */
export function SetBudgetDialog({
	title,
	description,
	currency,
	currentAmount,
	pending,
	onSubmit,
	trigger,
}: {
	title: string;
	description?: string;
	currency: string;
	/** Current budget in minor units, or null when unset. */
	currentAmount: number | null;
	pending: boolean;
	onSubmit: (amount: number | null) => Promise<unknown> | unknown;
	trigger: React.ReactNode;
}) {
	const [open, setOpen] = React.useState(false);
	const [value, setValue] = React.useState(
		currentAmount != null ? (currentAmount / 100).toFixed(2) : "",
	);
	const symbol = getSymbol(toCurrencyCode(currency) ?? "USD");

	const save = async () => {
		try {
			await onSubmit(parseMinor(value));
			setOpen(false);
		} catch {
			// mutation surfaces the error toast; keep the dialog open to retry.
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (next) {
					setValue(currentAmount != null ? (currentAmount / 100).toFixed(2) : "");
				}
			}}
		>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent className="sm:max-w-[420px]">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					{description ? (
						<DialogDescription>{description}</DialogDescription>
					) : null}
				</DialogHeader>

				<Field>
					<FieldLabel htmlFor="budget-amount">Budget amount</FieldLabel>
					<div className="relative">
						<span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground tabular-nums">
							{symbol}
						</span>
						<Input
							id="budget-amount"
							value={value}
							onChange={(e) => setValue(e.target.value)}
							inputMode="decimal"
							placeholder="0.00"
							autoComplete="off"
							className="pl-8 text-right tabular-nums"
						/>
					</div>
					<FieldDescription>Leave blank to remove the budget.</FieldDescription>
				</Field>

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => setOpen(false)}
						disabled={pending}
					>
						Cancel
					</Button>
					<Button type="button" onClick={save} disabled={pending}>
						{pending ? <Spinner /> : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
