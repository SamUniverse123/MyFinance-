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
import type { Category } from "@/features/categories/api";
import { getCategoryIconMeta } from "@/features/categories/category-visuals";
import { buildCategoryTree } from "@/features/categories/tree";
import { cn } from "@/lib/utils.ts";

function CategorySwatch({ category }: { category: Category }) {
	const meta = getCategoryIconMeta(category.icon);
	const Icon = meta.icon;
	return (
		<span
			className="flex size-5 shrink-0 items-center justify-center rounded-md"
			style={{
				color: category.color ?? undefined,
				backgroundColor: category.color ? `${category.color}1f` : undefined,
			}}
		>
			<Icon className="size-3.5" />
		</span>
	);
}

function CategoryOption({
	category,
	indent,
	selected,
	onSelect,
}: {
	category: Category;
	indent?: boolean;
	selected: boolean;
	onSelect: () => void;
}) {
	return (
		<CommandItem
			value={category.id}
			data-checked={selected ? "true" : undefined}
			onSelect={onSelect}
			className={cn(indent && "pl-7")}
		>
			<CategorySwatch category={category} />
			<span className="truncate">{category.name}</span>
		</CommandItem>
	);
}

export type CategoryComboboxProps = {
	categories: Category[];
	kind: Category["kind"];
	value: string | null;
	onChange: (id: string | null) => void;
	/** Enables an inline "Create '<query>'" row when the search has no exact match. */
	onCreate?: (input: {
		name: string;
		kind: Category["kind"];
	}) => Promise<Category>;
	/** Hide this id from the options — e.g. a category can't be its own parent. */
	excludeId?: string;
	/** Only offer top-level categories (ADR-0001: a subcategory can't itself be a parent). */
	parentsOnly?: boolean;
	/** Show a "none" row (uncategorized / promote to top-level, depending on context). */
	allowNone?: boolean;
	noneLabel?: string;
	placeholder?: string;
	disabled?: boolean;
};

/**
 * Searchable category picker, filtered to one kind (Q9 — a picker never crosses
 * income/expense). Reused for the transaction-form field (with inline creation)
 * and the management page's "parent" / "reassign to" pickers (without).
 */
export function CategoryCombobox({
	categories,
	kind,
	value,
	onChange,
	onCreate,
	excludeId,
	parentsOnly,
	allowNone,
	noneLabel,
	placeholder,
	disabled,
}: CategoryComboboxProps) {
	const [open, setOpen] = React.useState(false);
	const [query, setQuery] = React.useState("");
	const [creating, setCreating] = React.useState(false);

	const options = React.useMemo(() => {
		let list = categories.filter((c) => c.kind === kind && c.id !== excludeId);
		if (parentsOnly) list = list.filter((c) => c.parentId === null);
		return list;
	}, [categories, kind, excludeId, parentsOnly]);

	const tree = React.useMemo(() => buildCategoryTree(options), [options]);
	const selected = categories.find((c) => c.id === value) ?? null;

	const trimmedQuery = query.trim();
	const hasExactMatch = options.some(
		(c) => c.name.toLowerCase() === trimmedQuery.toLowerCase(),
	);
	const canCreate =
		Boolean(onCreate) && trimmedQuery.length > 0 && !hasExactMatch;

	async function handleCreate() {
		if (!onCreate || !trimmedQuery || creating) return;
		setCreating(true);
		try {
			const created = await onCreate({ name: trimmedQuery, kind });
			onChange(created.id);
			setOpen(false);
			setQuery("");
		} catch {
			// the caller's mutation surfaces the failure via toast; keep the popover open
		} finally {
			setCreating(false);
		}
	}

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
							<CategorySwatch category={selected} />
							<span className="truncate">{selected.name}</span>
						</span>
					) : (
						<span className="text-muted-foreground">
							{placeholder ?? "Select category"}
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
						placeholder="Search categories..."
						value={query}
						onValueChange={setQuery}
					/>
					<CommandList>
						<CommandEmpty>
							{canCreate ? (
								<CommandItem
									value={`__create__${trimmedQuery}`}
									onSelect={handleCreate}
									disabled={creating}
								>
									<Plus className="size-4" />
									{creating ? "Creating…" : `Create "${trimmedQuery}"`}
								</CommandItem>
							) : (
								"No categories found."
							)}
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

						{tree
							.filter((top) => matches(top, trimmedQuery))
							.map((top) => (
								<CommandGroup key={top.id}>
									{matchesSelf(top, trimmedQuery) && (
										<CategoryOption
											category={top}
											selected={value === top.id}
											onSelect={() => {
												onChange(top.id);
												setOpen(false);
											}}
										/>
									)}
									{!parentsOnly &&
										top.children
											.filter((child) => matchesSelf(child, trimmedQuery))
											.map((child) => (
												<CategoryOption
													key={child.id}
													category={child}
													indent
													selected={value === child.id}
													onSelect={() => {
														onChange(child.id);
														setOpen(false);
													}}
												/>
											))}
								</CommandGroup>
							))}

						{canCreate && options.length > 0 && (
							<CommandGroup>
								<CommandItem
									value={`__create__${trimmedQuery}`}
									onSelect={handleCreate}
									disabled={creating}
								>
									<Plus className="size-4" />
									{creating ? "Creating…" : `Create "${trimmedQuery}"`}
								</CommandItem>
							</CommandGroup>
						)}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

function matchesSelf(category: Category, query: string): boolean {
	return !query || category.name.toLowerCase().includes(query.toLowerCase());
}

function matches(
	top: Category & { children: Category[] },
	query: string,
): boolean {
	return (
		matchesSelf(top, query) || top.children.some((c) => matchesSelf(c, query))
	);
}
