import { ArrowLeftRight, Store, Tag, Wallet, X } from "lucide-react";
import { motion } from "motion/react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button.tsx";
import { AddAccount } from "#/features/accounts/components/add-account";
import { useGetAccounts } from "#/features/accounts/queries";
import { AddCategory } from "#/features/categories/components/add-category";
import { AddPayee } from "#/features/payees/components/add-payee";
import { AddTransaction } from "#/features/transactions/components/add-transaction";
import { cn } from "#/lib/utils.ts";

/** A big entity card. Used as the trigger `children` of an Add* modal — Radix Slot
 *  merges this onClick with the modal's open handler, so tapping both opens that
 *  modal and dismisses the picker. */
function EntityCard({
	icon,
	label,
	onClick,
	disabled,
}: {
	icon: React.ReactNode;
	label: string;
	onClick?: () => void;
	disabled?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={cn(
				"flex h-28 flex-col items-start justify-between rounded-xl border-2 bg-card p-4 text-left transition-colors inset-shadow-xs bg-stone-50 ",
				disabled
					? "opacity-50"
					: "hover:border-primary/40 hover:bg-accent active:bg-accent",
			)}
		>
			<span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-5">
				{icon}
			</span>
			<span className="text-sm font-medium">{label}</span>
		</button>
	);
}

/**
 * The "create" picker (grill-with-docs): a card-grid modal offering the four
 * business entities. Opened from the sidebar's Quick Create / collapsed round button.
 *
 * Built as an always-mounted overlay (not a Radix Dialog) on purpose — the Add*
 * modals live inside it, and unmounting them when the picker closes would also close
 * an Add* modal the user just opened. So the panel stays mounted and only toggles
 * visibility, mirroring `create-fab.tsx`. `children` is a render-prop handed an
 * `open()` to wire onto whatever trigger the caller supplies.
 */
export function CreatePicker({
	children,
}: {
	children: (open: () => void) => React.ReactNode;
}) {
	const [open, setOpen] = React.useState(false);
	const { data: accounts } = useGetAccounts();
	const hasAccounts = (accounts?.length ?? 0) > 0;
	const close = () => setOpen(false);

	// Close on Escape while open.
	React.useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open]);

	return (
		<>
			{children(() => setOpen(true))}

			{/* Always mounted so an opened Add* modal survives the picker closing. */}
			<div
				aria-hidden={!open}
				className={cn(
					"fixed inset-0 z-50 flex items-center justify-center p-4 ",
					!open && "pointer-events-none ",
				)}
			>
				<motion.div
					className="absolute inset-0 bg-black/40 "
					animate={{ opacity: open ? 1 : 0 }}
					transition={{ duration: 0.15 }}
					onClick={close}
				/>

				<motion.div
					role="dialog"
					aria-modal={open}
					aria-label="Create"
					initial={false}
					animate={{
						opacity: open ? 1 : 0,
						scale: open ? 1 : 0.96,
						y: open ? 0 : 8,
					}}
					transition={{ duration: 0.16 }}
					className="relative w-full max-w-md rounded-2xl border bg-popover p-5 shadow-lg "
				>
					<button
						type="button"
						aria-label="Close"
						onClick={close}
						className="absolute top-4 right-4 rounded-md opacity-60 transition-opacity hover:opacity-100 [&_svg]:size-5"
					>
						<X />
					</button>

					<h2 className="mb-4 text-base font-semibold">Create New</h2>

					<div className="grid grid-cols-2 gap-3">
						<AddAccount>
							<EntityCard
								icon={<Wallet />}
								label="Add account"
								onClick={close}
							/>
						</AddAccount>

						{hasAccounts ? (
							<AddTransaction>
								<EntityCard
									icon={<ArrowLeftRight />}
									label="Add transaction"
									onClick={close}
								/>
							</AddTransaction>
						) : (
							<EntityCard
								icon={<ArrowLeftRight />}
								label="Add transaction"
								disabled
								onClick={() => {
									toast.info(
										"Add an account first, then record a transaction.",
									);
									close();
								}}
							/>
						)}

						{/* Global context → kind is selectable in the form, defaulting to Expense. */}
						<AddCategory kind="expense">
							<EntityCard icon={<Tag />} label="Add category" onClick={close} />
						</AddCategory>

						<AddPayee>
							<EntityCard icon={<Store />} label="Add payee" onClick={close} />
						</AddPayee>
					</div>

					<div className="mt-5 flex justify-end">
						<Button variant="destructive" onClick={close}>
							Cancel
						</Button>
					</div>
				</motion.div>
			</div>
		</>
	);
}
