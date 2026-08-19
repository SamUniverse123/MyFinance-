import { ChevronsUpDown, Plus } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button.tsx";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command.tsx";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover.tsx";
import type { Payee } from "@/features/payees/api";
import { PayeeAvatar } from "@/features/payees/components/payee-avatar";

export type PayeeComboboxProps = {
	payees: Payee[];
	value: string | null;
	onChange: (id: string | null) => void;
	/** Enables an inline "Create '<query>'" row when the search has no exact match. */
	onCreate?: (name: string) => Promise<{ id: string; name: string }>;
	/** Show a "none" row (clears the payee). */
	allowNone?: boolean;
	noneLabel?: string;
	placeholder?: string;
	disabled?: boolean;
};

/**
 * Searchable payee picker with frictionless create-or-link (Q6). Selecting a payee
 * sets its id; the raw `payeeName` on a transaction is left untouched (Q7). Flat list,
 * client-filtered (Q16) — mirrors `category-combobox.tsx` without the color/icon swatch.
 */
export function PayeeCombobox({
	payees,
	value,
	onChange,
	onCreate,
	allowNone,
	noneLabel,
	placeholder,
	disabled,
}: PayeeComboboxProps) {
	const [open, setOpen] = React.useState(false);
	const [query, setQuery] = React.useState("");
	const [creating, setCreating] = React.useState(false);

	const selected = payees.find((p) => p.id === value) ?? null;

	const trimmedQuery = query.trim();
	const lowerQuery = trimmedQuery.toLowerCase();
	const filtered = React.useMemo(
		() => payees.filter((p) => p.name.toLowerCase().includes(lowerQuery)),
		[payees, lowerQuery],
	);
	const hasExactMatch = payees.some((p) => p.name.toLowerCase() === lowerQuery);
	const canCreate =
		Boolean(onCreate) && trimmedQuery.length > 0 && !hasExactMatch;

	async function handleCreate() {
		if (!onCreate || !trimmedQuery || creating) return;
		setCreating(true);
		try {
			const created = await onCreate(trimmedQuery);
			onChange(created.id);
			setOpen(false);
			setQuery("");
		} catch {
			// the caller's mutation surfaces the failure via toast; keep the popover open
		} finally {
			setCreating(false);
		}
	}

	const createRow = (
		<CommandItem
			value={`__create__${trimmedQuery}`}
			onSelect={handleCreate}
			disabled={creating}
		>
			<Plus className="size-4" />
			{creating ? "Creating…" : `Create "${trimmedQuery}"`}
		</CommandItem>
	);

	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) setQuery("");
			}}
		>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					role="combobox"
					aria-expanded={open}
					disabled={disabled}
					className="w-full justify-between font-normal"
				>
					{selected ? (
						<span className="flex min-w-0 items-center gap-2">
							<PayeeAvatar
								name={selected.name}
								domain={selected.domain}
								size={20}
							/>
							<span className="truncate">{selected.name}</span>
						</span>
					) : (
						<span className="text-muted-foreground truncate">
							{placeholder ?? "Select payee"}
						</span>
					)}
					<ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className="w-(--radix-popover-trigger-width) p-0"
				align="start"
			>
				<Command shouldFilter={false}>
					<CommandInput
						placeholder="Search payees..."
						value={query}
						onValueChange={setQuery}
					/>
					<CommandList>
						<CommandEmpty>
							{canCreate ? createRow : "No payees found."}
						</CommandEmpty>

						{allowNone && !trimmedQuery && (
							<CommandGroup>
								<CommandItem
									value="__none__"
									data-checked={value === null ? "true" : undefined}
									onSelect={() => {
										onChange(null);
										setOpen(false);
									}}
								>
									{noneLabel ?? "None"}
								</CommandItem>
							</CommandGroup>
						)}

						{filtered.length > 0 && (
							<CommandGroup>
								{filtered.map((payee) => (
									<CommandItem
										key={payee.id}
										value={payee.id}
										data-checked={value === payee.id ? "true" : undefined}
										onSelect={() => {
											onChange(payee.id);
											setOpen(false);
										}}
									>
										<PayeeAvatar
											name={payee.name}
											domain={payee.domain}
											size={20}
										/>
										<span className="truncate">{payee.name}</span>
									</CommandItem>
								))}
							</CommandGroup>
						)}

						{canCreate && filtered.length > 0 && (
							<CommandGroup>{createRow}</CommandGroup>
						)}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
