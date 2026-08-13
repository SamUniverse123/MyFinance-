import { useForm } from "@tanstack/react-form";
import * as React from "react";
import * as z from "zod";
import { useIsMobile } from "#/hooks/use-mobile.ts";
import {
	CATEGORY_COLORS,
	CATEGORY_ICONS,
	type CategoryIconValue,
	DEFAULT_CATEGORY_COLOR,
} from "@/features/categories/category-visuals";
import { cn } from "@/lib/utils.ts";

const ICON_VALUES = CATEGORY_ICONS.map((i) => i.value) as [
	CategoryIconValue,
	...CategoryIconValue[],
];

import { Button } from "@/components/ui/button.tsx";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog.tsx";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "@/components/ui/drawer.tsx";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Spinner } from "@/components/ui/spinner";
import type { Category } from "@/features/categories/api";
import { CategoryCombobox } from "@/features/categories/components/category-combobox";

export type CategoryFormValues = {
	name: string;
	kind: Category["kind"];
	color: string;
	icon: CategoryIconValue | "";
	parentId: string | null;
};

const formSchema = z.object({
	name: z.string().trim().min(1, "Give the category a name"),
	kind: z.enum(["income", "expense"]),
	color: z.string(),
	icon: z.union([z.enum(ICON_VALUES), z.literal("")]),
	parentId: z.string().nullable(),
});

function CategoryFormBody({
	idPrefix,
	categories,
	defaultValues,
	submitLabel,
	nameEditable,
	kindEditable,
	parentEditable,
	onSubmit,
	onCancel,
}: {
	idPrefix: string;
	categories: Category[];
	defaultValues: CategoryFormValues;
	submitLabel: string;
	nameEditable: boolean;
	kindEditable: boolean;
	parentEditable: boolean;
	onSubmit: (values: CategoryFormValues) => Promise<void>;
	onCancel: () => void;
}) {
	const form = useForm({
		defaultValues,
		validators: { onSubmit: formSchema },
		onSubmit: async ({ value }) => {
			try {
				await onSubmit(value);
				onCancel();
			} catch {
				// the mutation surfaces the failure via toast; keep the form open.
			}
		},
	});

	return (
		<form
			className="flex min-h-0 flex-1 flex-col"
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
		>
			<FieldGroup className="gap-5 overflow-y-auto px-4 py-1 md:-mx-2 md:px-2">
				<form.Field
					name="name"
					children={(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={`${idPrefix}-cat-name`}>
									Category name
								</FieldLabel>
								<Input
									id={`${idPrefix}-cat-name`}
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									aria-invalid={isInvalid}
									disabled={!nameEditable}
									placeholder="e.g. Groceries"
									autoComplete="off"
								/>
								{!nameEditable && (
									<FieldDescription>
										System categories can't be renamed.
									</FieldDescription>
								)}
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						);
					}}
				/>

				<form.Field
					name="kind"
					children={(field) => (
						<Field>
							<FieldLabel>Kind</FieldLabel>
							<div
								role="radiogroup"
								aria-label="Category kind"
								className="grid grid-cols-2 gap-2"
							>
								{(["expense", "income"] as const).map((k) => {
									const selected = field.state.value === k;
									return (
										<button
											key={k}
											type="button"
											role="radio"
											aria-checked={selected}
											disabled={!kindEditable}
											onClick={() => field.handleChange(k)}
											className={cn(
												"rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
												"disabled:cursor-not-allowed disabled:opacity-60",
												selected
													? k === "income"
														? "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
														: "border-transparent bg-muted text-foreground ring-2 ring-primary"
													: "border-border text-muted-foreground hover:bg-accent",
											)}
										>
											{k}
										</button>
									);
								})}
							</div>
							{!kindEditable && (
								<FieldDescription>
									This category has subcategories, so its kind can't change
									until they do.
								</FieldDescription>
							)}
						</Field>
					)}
				/>

				{parentEditable && (
					<form.Field
						name="parentId"
						children={(field) => (
							<form.Subscribe selector={(s) => s.values.kind}>
								{(kind) => (
									<Field>
										<FieldLabel>Parent category</FieldLabel>
										<CategoryCombobox
											categories={categories}
											kind={kind}
											value={field.state.value}
											onChange={field.handleChange}
											parentsOnly
											allowNone
											noneLabel="Top level (no parent)"
											placeholder="Top level"
										/>
										<FieldDescription>
											Subcategories are capped at one level — you can't nest
											under another subcategory.
										</FieldDescription>
									</Field>
								)}
							</form.Subscribe>
						)}
					/>
				)}

				<form.Field
					name="color"
					children={(field) => (
						<Field>
							<FieldLabel>Color</FieldLabel>
							<div
								role="radiogroup"
								aria-label="Category color"
								className="flex flex-wrap gap-2"
							>
								{CATEGORY_COLORS.map((c) => {
									const selected = field.state.value === c.value;
									return (
										<button
											key={c.value}
											type="button"
											role="radio"
											aria-checked={selected}
											aria-label={c.name}
											onClick={() => field.handleChange(c.value)}
											className={cn(
												"size-8 shrink-0 rounded-full outline-none transition-transform focus-visible:ring-3 focus-visible:ring-ring/50",
												selected &&
													"ring-2 ring-offset-2 ring-offset-background",
											)}
											style={{
												backgroundColor: c.value,
												...(selected && { boxShadow: `0 0 0 2px ${c.value}` }),
											}}
										/>
									);
								})}
							</div>
						</Field>
					)}
				/>

				<form.Field
					name="icon"
					children={(field) => (
						<Field>
							<FieldLabel>Icon</FieldLabel>
							<div
								role="radiogroup"
								aria-label="Category icon"
								className="grid max-h-40 grid-cols-6 gap-2 overflow-y-auto sm:grid-cols-8"
							>
								{CATEGORY_ICONS.map(({ value, label, icon: Icon }) => {
									const selected = field.state.value === value;
									return (
										<button
											key={value}
											type="button"
											role="radio"
											aria-checked={selected}
											aria-label={label}
											title={label}
											onClick={() => field.handleChange(value)}
											className={cn(
												"flex size-9 items-center justify-center rounded-lg border transition-colors outline-none",
												"hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
												selected
													? "border-primary bg-primary/10 text-primary"
													: "border-border",
											)}
										>
											<Icon className="size-4" />
										</button>
									);
								})}
							</div>
						</Field>
					)}
				/>
			</FieldGroup>

			<div className="mt-auto flex flex-col-reverse gap-2 px-4 py-4 sm:flex-row sm:justify-end sm:px-0 sm:pb-0">
				<Button type="button" variant="outline" onClick={onCancel}>
					Cancel
				</Button>
				<form.Subscribe selector={(s) => s.isSubmitting}>
					{(isSubmitting) => (
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting ? <Spinner /> : submitLabel}
						</Button>
					)}
				</form.Subscribe>
			</div>
		</form>
	);
}

/**
 * Responsive category form modal, shared by create and edit — same Dialog/Drawer
 * convention as `account-form.tsx` / `transaction-form.tsx`.
 *
 * `kindEditable`/`parentEditable` gate the two fields ADR-0001 and ADR-0002 restrict:
 * kind can't change while the category has subcategories, and system categories can't
 * be reorganized at all (see `docs/adr/0001...` / `0002...`).
 */
export function CategoryFormModal({
	title,
	description,
	submitLabel,
	categories,
	defaultValues,
	nameEditable = true,
	kindEditable = true,
	parentEditable = true,
	onSubmit,
	trigger,
}: {
	title: string;
	description: string;
	submitLabel: string;
	categories: Category[];
	defaultValues: CategoryFormValues;
	nameEditable?: boolean;
	kindEditable?: boolean;
	parentEditable?: boolean;
	onSubmit: (values: CategoryFormValues) => Promise<void>;
	trigger: React.ReactNode;
}) {
	const isMobile = useIsMobile();
	const [open, setOpen] = React.useState(false);

	const body = (
		<CategoryFormBody
			idPrefix={isMobile ? "m" : "d"}
			categories={categories}
			defaultValues={defaultValues}
			submitLabel={submitLabel}
			nameEditable={nameEditable}
			kindEditable={kindEditable}
			parentEditable={parentEditable}
			onSubmit={onSubmit}
			onCancel={() => setOpen(false)}
		/>
	);

	if (isMobile) {
		return (
			<Drawer open={open} onOpenChange={setOpen}>
				<DrawerTrigger asChild>{trigger}</DrawerTrigger>
				<DrawerContent className="max-h-[92vh]">
					<DrawerHeader className="text-left">
						<DrawerTitle>{title}</DrawerTitle>
						<DrawerDescription>{description}</DrawerDescription>
					</DrawerHeader>
					{body}
				</DrawerContent>
			</Drawer>
		);
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent className="gap-5 sm:max-w-[540px]">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				{body}
			</DialogContent>
		</Dialog>
	);
}

export { DEFAULT_CATEGORY_COLOR };
