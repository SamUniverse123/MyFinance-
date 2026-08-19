import * as React from "react";
import { useIsMobile } from "#/hooks/use-mobile.ts";
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
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "@/components/ui/drawer.tsx";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Spinner } from "@/components/ui/spinner";
import { PayeeAvatar } from "@/features/payees/components/payee-avatar";
import { useBrandSearch } from "@/features/payees/queries";

export type PayeeFormValues = { name: string; domain: string | null };

/** Small debounce so the brand typeahead fires on a pause, not every keystroke. */
function useDebounced<T>(value: T, delay: number): T {
	const [debounced, setDebounced] = React.useState(value);
	React.useEffect(() => {
		const t = setTimeout(() => setDebounced(value), delay);
		return () => clearTimeout(t);
	}, [value, delay]);
	return debounced;
}

/**
 * Responsive add/edit payee modal. The Name field doubles as a logo.dev brand-search
 * typeahead (Q9): typing surfaces matching brands with logos, and picking one adopts
 * its name + domain (Q10). Free text is always allowed for payees not in the brand DB,
 * and a manual Website field (Q11) attaches a domain for those. `onSubmit` throws on
 * failure so the modal stays open; the caller's mutation surfaces the toast.
 */
export function PayeeFormModal({
	title,
	description,
	submitLabel,
	defaultName = "",
	defaultDomain = "",
	onSubmit,
	trigger,
}: {
	title: string;
	description: string;
	submitLabel: string;
	defaultName?: string;
	defaultDomain?: string;
	onSubmit: (values: PayeeFormValues) => Promise<void>;
	trigger: React.ReactNode;
}) {
	const isMobile = useIsMobile();
	const [open, setOpen] = React.useState(false);
	const [name, setName] = React.useState(defaultName);
	const [domain, setDomain] = React.useState(defaultDomain);
	const [focused, setFocused] = React.useState(false);
	const [submitting, setSubmitting] = React.useState(false);

	// Reset to the current defaults each time the modal opens.
	React.useEffect(() => {
		if (open) {
			setName(defaultName);
			setDomain(defaultDomain);
		}
	}, [open, defaultName, defaultDomain]);

	const debouncedName = useDebounced(name, 300);
	const { data: results, isFetching } = useBrandSearch(debouncedName);
	const trimmed = name.trim();
	const showResults =
		focused && trimmed.length >= 2 && (results?.length ?? 0) > 0;

	function pick(result: { name: string; domain: string }) {
		setName(result.name);
		setDomain(result.domain);
		setFocused(false);
	}

	async function submit() {
		if (!trimmed || submitting) return;
		setSubmitting(true);
		try {
			await onSubmit({ name: trimmed, domain: domain.trim() || null });
			setOpen(false);
		} catch {
			// mutation surfaces the failure via toast; keep the modal open
		} finally {
			setSubmitting(false);
		}
	}

	const fields = (
		<FieldGroup className="gap-4 px-4 md:px-0">
			<Field>
				<FieldLabel htmlFor="payee-name">Name</FieldLabel>
				<div className="relative">
					<div className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2">
						<PayeeAvatar name={trimmed || "?"} domain={domain} size={22} />
					</div>
					<Input
						id="payee-name"
						value={name}
						onChange={(e) => {
							setName(e.target.value);
							setFocused(true);
						}}
						onFocus={() => setFocused(true)}
						// Delay so a result click registers before the list hides.
						onBlur={() => setTimeout(() => setFocused(false), 120)}
						placeholder="Search a brand, or type any name"
						autoComplete="off"
						className="pl-10"
						autoFocus
					/>
					{isFetching && trimmed.length >= 2 && (
						<div className="absolute top-1/2 right-2.5 -translate-y-1/2">
							<Spinner className="size-4 text-muted-foreground" />
						</div>
					)}
					{showResults && (
						<ul className="absolute top-full right-0 left-0 z-50 mt-1 max-h-64 overflow-auto rounded-lg border bg-popover p-1 shadow-lg">
							{results?.map((r) => (
								<li key={`${r.name}-${r.domain}`}>
									<button
										type="button"
										// mousedown fires before input blur — keep the list alive to register the pick
										onMouseDown={(e) => e.preventDefault()}
										onClick={() => pick(r)}
										className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
									>
										<PayeeAvatar name={r.name} domain={r.domain} size={24} />
										<span className="min-w-0 flex-1 truncate font-medium">
											{r.name}
										</span>
										<span className="shrink-0 truncate text-xs text-muted-foreground">
											{r.domain}
										</span>
									</button>
								</li>
							))}
						</ul>
					)}
				</div>
			</Field>

			<Field>
				<FieldLabel htmlFor="payee-domain">Website</FieldLabel>
				<Input
					id="payee-domain"
					value={domain}
					onChange={(e) => setDomain(e.target.value)}
					placeholder="e.g. netflix.com (optional — for the logo)"
					autoComplete="off"
					inputMode="url"
				/>
			</Field>
		</FieldGroup>
	);

	const footer = (
		<>
			<Button type="button" variant="outline" onClick={() => setOpen(false)}>
				Cancel
			</Button>
			<Button type="submit" disabled={!trimmed || submitting}>
				{submitting ? <Spinner /> : submitLabel}
			</Button>
		</>
	);

	if (isMobile) {
		return (
			<Drawer open={open} onOpenChange={setOpen}>
				<DrawerTrigger asChild>{trigger}</DrawerTrigger>
				<DrawerContent>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							submit();
						}}
					>
						<DrawerHeader className="text-left">
							<DrawerTitle>{title}</DrawerTitle>
							<DrawerDescription>{description}</DrawerDescription>
						</DrawerHeader>
						{fields}
						<DrawerFooter className="flex-col-reverse sm:flex-row sm:justify-end">
							{footer}
						</DrawerFooter>
					</form>
				</DrawerContent>
			</Drawer>
		);
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent className="sm:max-w-[440px]">
				<form
					onSubmit={(e) => {
						e.preventDefault();
						submit();
					}}
				>
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
						<DialogDescription>{description}</DialogDescription>
					</DialogHeader>
					<div className="py-4">{fields}</div>
					<DialogFooter>{footer}</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
